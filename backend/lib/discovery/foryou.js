/**
 * Personalised scoring — the "For You" affinity model.
 *
 * The existing frontend recommender (`frontend/src/recommend/`) already builds a
 * rich user profile, but it lives in the browser, which means it cannot influence
 * what gets *discovered*. This module ports the same idea to the server so the
 * candidate pool itself can be steered by what someone actually listens to.
 *
 * Three design decisions worth stating:
 *
 *   1. **The profile arrives per request.** Listening data lives in `localStorage`,
 *      so there is no server-side user to look up. The frontend posts a compact
 *      summary — affinities, not a listening history. Nothing raw leaves the
 *      device: no track titles, no timestamps, no per-play records.
 *   2. **Affinity is data-limited.** A single listen cannot establish a preference,
 *      so every affinity is scaled by a confidence factor derived from how much
 *      evidence backs it. A cold profile produces a *neutral* result rather than a
 *      confidently wrong one.
 *   3. **Skips subtract.** Repeatedly skipping an artist is negative evidence, and
 *      it is the one signal that lets a user push music away rather than only pull
 *      music towards them.
 *
 * Pure functions. The same profile and candidate always produce the same score,
 * which is what makes this testable.
 */

import { leadArtistName } from '../metadata/identity.js';

/** Weight table, exported so the status route can report it and tests can assert it. */
export const FORYOU_WEIGHTS = {  userAffinity: 30,
  languageAffinity: 18,
  artistAffinity: 20,
  genreAffinity: 12,
  metadataQuality: 6,
  freshness: 8,
  popularity: 6,
};

/** How much the negative signals may subtract, in points. */
export const PENALTY_WEIGHTS = {
  skip: 18,
  alreadyPlayed: 8,
};

/**
 * How much to trust an affinity for a key, given the total evidence behind it.
 *
 * Diminishing returns: 1 unit of evidence gives ~0.2 confidence, 5 gives ~0.56,
 * 25 gives ~0.86. Without this a user who played one song ten times would develop
 * a stronger "taste" than someone who played forty different songs.
 */
export function confidenceFor(evidence) {
  if (!Number.isFinite(evidence) || evidence <= 0) return 0;
  return evidence / (evidence + 4);
}

/**
 * A normalised affinity map with the evidence weight that produced it.
 *
 * Values are already divided by the strongest key, so the map reads as "this is
 * the user's favourite artist, this one is second". `total` is what gates
 * confidence.
 */
export function affinityMap(entries = {}) {
  const raw = new Map();
  let max = 0;

  for (const [key, value] of Object.entries(entries)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    raw.set(String(key).toLowerCase(), numeric);
    if (numeric > max) max = numeric;
  }

  // Normalise against the strongest key, *after* finding it. Clamping first would
  // break this: a map holding a single artist at weight 10 would clamp to 1 and
  // then divide by 10, reporting 0.1 for the user's own favourite artist.
  const map = new Map();
  for (const [key, value] of raw) map.set(key, max > 0 ? Math.min(1, value / max) : 0);

  const total = [...map.values()].reduce((sum, v) => sum + v, 0);
  return { map, total, max };
}

/**
 * Build the server-side profile from a client summary.
 *
 * Accepts either raw counters or already-normalised affinities. Raw counters are
 * preferred when present because they preserve the relative weighting that a
 * normalised map throws away.
 *
 * @param {object} input
 * @param {object} [input.artists]      { 'artist name': weight }
 * @param {object} [input.languages]    { 'ml': weight }
 * @param {object} [input.genres]       { 'pop': weight }
 * @param {object} [input.skippedArtists]
 * @param {string[]} [input.playedKeys]  Already-played track identities.
 * @param {number} [input.totalPlays]
 * @returns {object} profile
 */
export function buildProfile(input = {}) {
  const artists = affinityMap(input.artists);
  const languages = affinityMap(input.languages);
  const genres = affinityMap(input.genres);
  const skipped = affinityMap(input.skippedArtists);

  const totalPlays = Number(input.totalPlays) || 0;

  // Confidence is global: it reflects how much the *whole* profile is worth
  // trusting, so a single strong artist does not manufacture certainty.
  const evidence = artists.total + languages.total + genres.total;
  const confidence = confidenceFor(evidence);

  const playedKeys = new Set((input.playedKeys ?? []).map((k) => String(k).toLowerCase()).filter(Boolean));

  return {
    artists,
    languages,
    genres,
    skipped,
    playedKeys,
    totalPlays,
    evidence,
    confidence,
    /** True when there is enough signal for personalisation to mean anything. */
    hasHistory: evidence > 0,
    tier: tierFor(totalPlays, evidence),
  };
}

/**
 * Personalisation tier, mirroring the frontend's five-stage model so the two
 * systems agree about what "a new user" means.
 */
export function tierFor(totalPlays, evidence) {
  if (totalPlays >= 200) return 'advanced';
  if (totalPlays >= 50) return 'strong';
  if (totalPlays >= 10) return 'learning';
  return totalPlays > 0 || evidence > 0 ? 'early' : 'cold';
}

/**
 * Blend of the user's personal signals for one candidate, 0..1.
 *
 * Returns null when nothing is known, which callers treat as "no evidence" rather
 * than as zero — otherwise every unknown track would be scored as disliked.
 */
export function userAffinity(track, profile) {
  if (!profile?.hasHistory) return null;

  const parts = [];
  const push = (value, weight) => {
    if (value === null || value === undefined) return;
    parts.push({ value: Math.max(0, Math.min(1, value)), weight });
  };

  push(profile.languages.map.get(String(track?.language ?? '').toLowerCase()) ?? 0, FORYOU_WEIGHTS.languageAffinity);
  push(leadArtistAffinity(track, profile), FORYOU_WEIGHTS.artistAffinity);
  push(meanGenreAffinity(track, profile), FORYOU_WEIGHTS.genreAffinity);

  if (parts.length === 0) return null;

  const total = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  const applied = parts.reduce((sum, p) => sum + p.weight, 0);

  // Scale by confidence so a thin profile cannot produce a strong opinion.
  return applied > 0 ? (total / applied) * profile.confidence : null;
}

/** Affinity for a track's lead artist, minus any skip penalty on that artist. */
export function leadArtistAffinity(track, profile) {
  if (!profile) return null;
  const key = leadArtistKey(track);
  if (!key) return null;

  const affinity = profile.artists.map.get(key) ?? 0;
  const skip = profile.skipped.map.get(key) ?? 0;

  // A skipped artist can never be promoted by a positive score. Skips subtract
  // from affinity but cannot drive it below zero, and a skip that meets or exceeds
  // the affinity zeroes it outright — using a comparison rather than a subtraction
  // so the result is exactly 0 and not floating-point residue.
  if (skip >= affinity && skip > 0) return 0;

  return Math.max(0, affinity - skip * 0.9);
}

/** Mean affinity across the track's genres. */
export function meanGenreAffinity(track, profile) {
  const genres = (track?.genres ?? []).map((g) => String(g).toLowerCase());
  if (genres.length === 0 || !profile) return null;

  let sum = 0;
  for (const genre of genres) sum += profile.genres.map.get(genre) ?? 0;

  return sum / genres.length;
}

/**
 * Skip penalty in points, 0..PENALTY_WEIGHTS.skip.
 *
 * Driven by the artist's recorded skip behaviour rather than the track's own skip
 * count, because what a user wants pushed away is nearly always an artist rather
 * than one song.
 */
export function skipPenalty(track, profile) {
  if (!profile) return 0;
  const key = leadArtistKey(track);
  if (!key) return 0;

  const skip = profile.skipped.map.get(key) ?? 0;
  return PENALTY_WEIGHTS.skip * Math.min(1, skip) * profile.confidence;
}

/** Mild penalty for a track the user has already played recently. */
export function playedPenalty(track, profile) {
  if (!profile?.playedKeys?.size) return 0;
  const keys = [track?.id, track?.youtubeId].filter(Boolean).map((k) => String(k).toLowerCase());
  const hit = keys.some((k) => profile.playedKeys.has(k));
  return hit ? PENALTY_WEIGHTS.alreadyPlayed * profile.confidence : 0;
}

/**
 * Lead artist identity.
 *
 * Delegates to the shared splitter so artist identity means exactly one thing
 * across the metadata layer, the diversity cap and this module. A local regex
 * here previously mangled names containing the letter "x" ("Max" -> "Ma").
 */
export function leadArtistKey(track) {
  const first = leadArtistName(track?.artist);
  if (!first) return null;
  return ['unknown', 'various artists', 'various'].includes(first) ? null : first;
}

/**
 * Score one candidate for a "For You" shelf, 0..100.
 *
 * Composes independent signals and subtracts the negative ones, returning the
 * breakdown so a recommendation can be explained rather than being opaque.
 *
 * @param {object} track         Candidate, ideally canonical.
 * @param {object} profile       From `buildProfile`.
 * @param {object} [context]     Discovery evidence (queryCount, rank, signals).
 * @returns {{score: number, parts: object, reason: string}}
 */
export function forYouScore(track, profile, context = {}) {
  const w = FORYOU_WEIGHTS;
  const signals = context.signals ?? {};

  const affinity = userAffinity(track, profile);
  const language = affinityForLanguage(track, profile);
  const artist = leadArtistAffinity(track, profile);
  const genre = meanGenreAffinity(track, profile);
  const quality = Number.isFinite(track?.metadataQuality) ? track.metadataQuality : null;
  const freshness = signals.releaseRecency ?? signals.recency ?? null;
  const popularity = crossQueryPopularity(context);

  const parts = {
    userAffinity: nullable(affinity, w.userAffinity),
    languageAffinity: nullable(language, w.languageAffinity),
    artistAffinity: nullable(artist, w.artistAffinity),
    genreAffinity: nullable(genre, w.genreAffinity),
    metadataQuality: nullable(quality, w.metadataQuality),
    freshness: nullable(freshness, w.freshness),
    popularity: nullable(popularity, w.popularity),
  };

  const base = Object.values(parts).reduce((sum, value) => sum + (value ?? 0), 0);

  const penalties = {
    skip: skipPenalty(track, profile),
    alreadyPlayed: playedPenalty(track, profile),
  };
  const totalPenalty = Object.values(penalties).reduce((sum, value) => sum + value, 0);

  // Penalties scale with the affinity terms rather than the raw sum, so a track
  // that earned nothing personal is not pushed below zero by a skip penalty it
  // never had the score to earn.
  const penaltyScale = base > 0 ? Math.min(1, totalPenalty / (w.userAffinity * 0.6)) : 0;
  const appliedPenalty = totalPenalty * penaltyScale;

  const score = Math.max(0, Math.min(100, Math.round((base - appliedPenalty) * 10) / 10));

  return {
    score,
    parts: {
      ...parts,
      skipPenalty: round(penalties.skip),
      alreadyPlayedPenalty: round(penalties.alreadyPlayed),
      baseTotal: round(base),
      personalisationConfidence: round(profile?.confidence ?? 0),
    },
    reason: explain(track, profile, { affinity, artist, language, genre, skip: penalties.skip }),
  };
}

function affinityForLanguage(track, profile) {
  if (!profile || !track?.language) return null;
  return profile.languages.map.get(String(track.language).toLowerCase()) ?? 0;
}

/** Cross-query presence plus search rank, as a cheap popularity stand-in. */
function crossQueryPopularity(context) {
  const count = Number(context.queryCount) || 0;
  const rank = Number(context.bestRank);
  const cross = Math.min(1, count / 4);
  const rankScore = Number.isFinite(rank) ? Math.max(0, 1 - (rank - 1) / 29) : 0;
  return count === 0 && !Number.isFinite(rank) ? null : cross * 0.6 + rankScore * 0.4;
}

function nullable(value, weight) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return round(weight * Math.max(0, Math.min(1, value)));
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * A short, human-readable justification.
 *
 * Derived from the same signals as the score, so the explanation cannot claim a
 * reason the arithmetic did not actually use.
 */
function explain(track, profile, { affinity, artist, language, genre, skip }) {
  if (!profile?.hasHistory) return 'Popular picks for you';

  // A skip is the most actionable thing to tell someone, so it outranks a
  // positive reason: "Not what you usually skip" is more useful than praising an
  // artist the listener has been rejecting.
  if (skip >= PENALTY_WEIGHTS.skip * 0.2) return 'Not what you usually skip';

  if (affinity === null) return 'New for you';

  if (language !== null && language > 0.5) {
    const name = track?.languageName ?? track?.language;
    return `Because you listen to ${name}`;
  }
  if (artist !== null && artist > 0.5) return 'From an artist you play';
  if (genre !== null && genre > 0.4) return 'Matches your genre taste';
  if (affinity > 0.3) return 'Similar to what you play';

  return 'New for you';
}
