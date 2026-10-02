/**
 * Freshness, velocity and release-age logic.
 *
 * This is the part that makes "trending" and "newly released" different things
 * rather than two names for the same sorted list.
 *
 *   - `recencyScore`     exponential decay over upload age
 *   - `velocityScore`    views per day, on a log scale so lifetime totals cannot
 *                        dominate
 *   - `releaseAssessment` decides whether a recently uploaded video is actually a
 *                        new song, which is the distinction the whole "latest"
 *                        concept rests on
 *
 * Every function is pure and takes `now` explicitly, so the behaviour is testable
 * and does not silently depend on the wall clock.
 */

import { envNum } from '../runtime/env.js';

const DAY_MS = 86400000;

/**
 * Default decay factors, in days.
 *
 * Trending decays slowly on purpose: a song can legitimately stay on a trending
 * shelf for weeks, and a sharp decay would empty it every few days. "Latest"
 * decays far faster, because a release stops being new quickly.
 */
export const DECAY = {
  trending: 45,
  latest: 21,
  release: 30,
  velocity: 30,
};

/**
 * The window inside which a track can be considered trending at all.
 *
 * This exists because of a measurement limitation, not a taste judgement.
 * YouTube's search endpoint exposes no trending feed and no view time-series, so
 * the only view number available is a lifetime total. Lifetime views divided by
 * lifetime age still yields a high rate for a nine-year-old video, because it
 * accrued its views when it was current — a 291M-view track from 2017 scores 0.87
 * "velocity" despite having no momentum at all.
 *
 * So the honest treatment is a gate rather than another weighted term: outside
 * this window a track is not trending, and no amount of accumulated views can
 * promote it. Inside the window the gate is 1 and ordinary scoring applies, with
 * a soft falloff afterwards so a genuinely durable hit degrades rather than
 * dropping off a cliff.
 *
 * Set to ~7 months: long enough that a regional shelf is not starved of genuinely
 * current releases, short enough that a year-old track cannot pass as trending.
 */
export const trendingWindowDays = () => envNum('SPOTUNER_TRENDING_WINDOW_DAYS', 210);

/**
 * The window inside which a track can be presented as a *release*.
 *
 * Wider than the trending window, because "new releases" legitimately covers the
 * past year — a regional catalogue produces few releases per month, and a 150-day
 * window left the Malayalam latest shelf padded with four-year-old tracks once
 * the score floor was added. What the gate prevents is not "somewhat old" but
 * "catalogue presented as new".
 */
export const releaseWindowDays = () => envNum('SPOTUNER_RELEASE_WINDOW_DAYS', 365);

/** Days over which a track outside the window fades out completely. */
const GATE_FALLOFF_DAYS = 45;

/**
 * Hard-ish recency gate, 0..1.
 *
 *   age <= window        -> 1
 *   age  = window + 45   -> ~0.37
 *   age  = window + 135  -> ~0.05
 *
 * Multiplied into the trending score so it cannot be outvoted by view totals.
 */
export function freshnessGate(ageInDays, windowDays = trendingWindowDays()) {
  if (!Number.isFinite(ageInDays)) return 0.5; // unknown age: neither trusted nor discarded
  if (ageInDays <= windowDays) return 1;

  return Math.exp(-(ageInDays - windowDays) / GATE_FALLOFF_DAYS);
}

/**
 * Gate applied to the "latest" score.
 *
 * Uses release age when a release date exists and upload age otherwise, so a
 * track with no stated release date is still judged on when it appeared rather
 * than escaping the gate entirely.
 *
 * Same reasoning as `freshnessGate`: the cross-query and search-rank terms are
 * age-blind, so without a multiplicative gate a four-year-old track can reach a
 * respectable score purely by being widely surfaced.
 */
export function releaseGate(releaseAgeInDays, uploadAgeInDays, windowDays = releaseWindowDays()) {
  const age = Number.isFinite(releaseAgeInDays)
    ? releaseAgeInDays
    : Number.isFinite(uploadAgeInDays)
      ? uploadAgeInDays
      : null;

  return freshnessGate(age, windowDays);
}

/**
 * Age used for the velocity term.
 *
 * No capping is applied, and that is deliberate. An earlier version capped the
 * divisor at the trending window on the reasoning that it would be "conservative"
 * for old tracks — but the arithmetic runs the other way: dividing a lifetime
 * total by a *smaller* number raises views/day, so capping inflated old tracks
 * rather than dampening them.
 *
 * The honest measure for a current track is its lifetime rate over the freshness
 * gate, which is applied multiplicatively to the whole trending score. Velocity
 * therefore reports what is actually measurable, and the gate decides what counts
 * as current.
 */
export function effectiveVelocityAge(ageInDays) {
  return ageInDays;
}

/** Exponential time decay: `exp(-ageInDays / decayFactor)`, clamped to 0..1. */
export function recencyScore(ageInDays, decayFactor = DECAY.trending) {
  if (!Number.isFinite(ageInDays) || ageInDays < 0) return 0;
  return Math.exp(-ageInDays / Math.max(decayFactor, 0.0001));
}

/**
 * Views per day, normalised to 0..1 on a log scale.
 *
 * Raw velocity is useless as a number: 500k views in 2 days and 100M views over
 * 5 years differ by four orders of magnitude, and the older one wins every
 * naive comparison. Taking log10 before normalising makes the comparison about
 * order of growth instead of total accumulation.
 *
 * Reference points, chosen from the range real music videos occupy:
 *   1e2 views/day  -> ~0.33   (modest back catalogue)
 *   1e3 views/day  -> ~0.50
 *   1e4 views/day  -> ~0.67   (a solid hit)
 *   1e5 views/day  -> ~0.83
 *   1e6 views/day  -> ~1.00   (currently viral)
 *
 * Returns null when views or age are unknown, so callers can distinguish
 * "not trending" from "not measurable".
 */
export function velocityScore(viewCount, ageInDays) {
  if (!Number.isFinite(viewCount) || viewCount <= 0) return null;
  if (!Number.isFinite(ageInDays) || ageInDays < 0) return null;

  // Clamp the divisor: a video uploaded minutes ago would otherwise divide by
  // near-zero and claim infinite velocity.
  const days = Math.max(ageInDays, 0.5);
  const perDay = viewCount / days;
  const score = (Math.log10(perDay) + 2) / 8; // 1e2 -> 0.25, 1e6 -> 1.0
  return Math.max(0, Math.min(1, score));
}

/**
 * Coerce a date-ish value to a Date, or null.
 *
 * Accepts a Date, an ISO string, or epoch milliseconds because the canonical
 * track shape stores dates as ISO strings (they survive JSON, which a Date does
 * not), while older callers pass real Date objects. Tolerating both means the
 * normalisation layer does not have to know which consumers hold which.
 */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Whole days between a date and now. null when the date is unknown. */
export function ageInDays(date, now = new Date()) {
  const target = toDate(date);
  if (!target) return null;

  const days = (now.getTime() - target.getTime()) / DAY_MS;
  return days >= 0 ? days : 0;
}

/**
 * Like-to-view ratio: engagement rather than reach.
 *
 * A video with 10M views and 200k likes and one with 400k views and 20k likes are
 * similarly engaged; only the ratio captures that. Capped, because ratios above
 * ~10% are usually fan-uploaded content rather than mainstream music.
 */
export function engagementScore(viewCount, likeCount) {
  if (!Number.isFinite(viewCount) || viewCount <= 0) return null;
  if (!Number.isFinite(likeCount) || likeCount < 0) return null;

  const ratio = likeCount / viewCount;
  return Math.max(0, Math.min(1, ratio / 0.1));
}

/**
 * Decide whether a track is a genuinely new release.
 *
 * A recent upload date is explicitly *not* sufficient. "Official Video - Song Name"
 * uploaded last week may be a five-year-old recording. The decision weighs:
 *
 *   positive  a real `release_date` close to the upload date
 *   positive  distributor delivery / auto-generated / Topic channel
 *   positive  an explicit "Released on:" date in the description
 *   negative  a long gap between music release and upload (re-upload)
 *   negative  remaster/live/tribute-style titles
 *
 * @returns {{isNewRelease: boolean, confidence: number, reasons: string[]}}
 */
export function releaseAssessment(track, evidence, now = new Date()) {
  const reasons = [];
  let score = 0;

  const releaseAge = ageInDays(track.releaseDate, now);
  const uploadAge = ageInDays(track.uploadDate, now);

  // --- Positives: it really is new ---
  if (Number.isFinite(releaseAge)) {
    if (releaseAge <= 30) {
      score += 0.45;
      reasons.push(`released ${Math.round(releaseAge)}d ago`);
    } else if (releaseAge <= 180) {
      score += 0.2;
      reasons.push(`released ${Math.round(releaseAge)}d ago`);
    }
  }

  if (evidence.isTopic) {
    score += 0.2;
    reasons.push('distributor topic channel');
  }
  if (evidence.markers.includes('auto_generated')) {
    score += 0.12;
    reasons.push('auto-generated by youtube');
  }
  if (evidence.markers.includes('distributor_delivery')) {
    score += 0.08;
    reasons.push('distributor delivery');
  }
  if (evidence.markers.includes('released_on_stated')) {
    score += 0.1;
    reasons.push('release date stated in description');
  }

  // --- Negatives: old music resurfacing ---
  if (Number.isFinite(evidence.uploadLagDays) && evidence.uploadLagDays > 180) {
    score -= 0.4;
    reasons.push(`uploaded ${evidence.uploadLagDays}d after release (re-upload)`);
  } else if (Number.isFinite(evidence.uploadLagDays) && evidence.uploadLagDays > 30) {
    score -= 0.18;
    reasons.push(`uploaded ${evidence.uploadLagDays}d after release`);
  }

  if (evidence.markers.includes('title_rerelease_marker')) {
    score -= 0.3;
    reasons.push('title suggests remaster/live/tribute');
  }

  // Recently uploaded but no release information at all. YouTube uploads of
  // older music are extremely common, so absence of evidence leans negative.
  if (!Number.isFinite(releaseAge)) {
    if (Number.isFinite(uploadAge) && uploadAge <= 7) {
      score -= 0.08;
      reasons.push('recent upload, no release date');
    } else {
      score -= 0.12;
      reasons.push('no release date');
    }
  }

  const clamped = Math.max(0, Math.min(1, score));
  const isNewRelease = clamped >= 0.5;

  if (!isNewRelease && reasons.length === 0) {
    reasons.push('insufficient release evidence');
  }

  return { isNewRelease, confidence: clamped, reasons };
}

/**
 * Assemble every freshness-related score for one hydrated track.
 *
 * Kept separate from `score.js` so the raw signals remain inspectable in the API
 * response, which is what makes the ranking auditable rather than a black box.
 */
export function freshnessSignals(track, evidence, now = new Date()) {
  const uploadAge = ageInDays(track.uploadDate, now);
  const releaseAge = ageInDays(track.releaseDate, now);

  const views = Number.isFinite(track.viewCount) ? track.viewCount : track.playCount;

  return {
    ageInDays: uploadAge === null ? null : Math.round(uploadAge * 10) / 10,
    releaseAgeInDays: releaseAge === null ? null : Math.round(releaseAge * 10) / 10,
    uploadAgeInDays: uploadAge === null ? null : Math.round(uploadAge * 10) / 10,
    views: views ?? null,
    recency: recencyScore(uploadAge, DECAY.trending),
    releaseRecency: recencyScore(releaseAge, DECAY.latest),
    velocity: velocityScore(views, uploadAge),
    releaseVelocity: velocityScore(views, releaseAge),
    // Trending-specific signals: the raw rate plus the recency gate that decides
    // whether that rate describes anything currently true.
    velocityForTrending: velocityScore(views, effectiveVelocityAge(uploadAge)),
    freshnessGate: freshnessGate(uploadAge),
    releaseGate: releaseGate(releaseAge, uploadAge),
    engagement: engagementScore(views, track.likeCount),
    ...releaseAssessment(track, evidence, now),
  };
}