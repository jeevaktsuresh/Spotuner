/**
 * Cross-provider track matching.
 *
 * The same song exists on YouTube and Spotify under different names:
 *
 *   Spotify   "Malare" — Vijay Yesudas
 *   YouTube   "Malare Official Video" — Vijay Yesudas
 *
 * These are one recording and must resolve to one canonical track, so a listener
 * does not see the same song twice in search results.
 *
 * `identity.js` already implements the hard part — variant detection and the
 * three-tier ISRC/recording-id/fuzzy cascade. This module adds what
 * provider-to-provider matching specifically needs:
 *
 *   1. **Confidence.** `identity.js` answers "are these the same?"; matching also
 *      has to answer "how sure are we?", because a low-confidence link should
 *      enrich rather than merge.
 *   2. **Duration corroboration.** Two tracks with the same title and artist can
 *      still be a 3-minute radio edit and a 6-minute album cut. YouTube durations
 *      are unreliable enough that this is a signal, not a gate.
 *   3. **Album agreement**, as a tiebreaker when titles are ambiguous.
 *
 * The variant rule is inherited and is the important one: a remix, live take,
 * acoustic version or cover is never merged into its original, because silently
 * collapsing them deletes distinct music from search results.
 */

import { identityOf, matchTracks, variantMarkers, normalizeText, titleSimilarity } from './identity.js';

/**
 * Below this, two records are related but not merged.
 *
 * The band exists because title matching alone is not sufficient evidence when the
 * two sources disagree about anything structural. Merging on title alone risks
 * hiding a track a listener explicitly searched for.
 */
export const MERGE_CONFIDENCE = 0.86;

/**
 * Link rather than merge.
 *
 * Used when the evidence points at the same recording but a conflict — a duration
 * mismatch, a variant disagreement — makes automatic merging unsafe. The metadata
 * is still worth taking; the records just stay separate.
 */
export const LINK_CONFIDENCE = 0.6;

/** Durations within this many seconds are treated as the same cut. */
const DURATION_TOLERANCE_SECONDS = 12;

/** Fraction of the shorter duration that may differ before it is a real mismatch. */
const DURATION_TOLERANCE_RATIO = 0.06;

/**
 * Score how likely two records describe the same recording, 0..1.
 *
 * @param {object} a
 * @param {object} b
 * @returns {{confidence: number, level: string, reason: string, durationMatch: boolean|null}}
 */
export function matchConfidence(a, b) {
  if (!a || !b) return { confidence: 0, level: 'none', reason: 'missing track', durationMatch: null };

  // --- strongest evidence first ---
  const idA = identityOf(a);
  const idB = identityOf(b);

  // Two different ISRCs are two different recordings. Absolute, and checked before
  // anything fuzzy so a remix with its own ISRC is never merged by title.
  if (idA.level === 'isrc' && idB.level === 'isrc') {
    if (idA.key !== idB.key) {
      return { confidence: 0, level: 'isrc', reason: 'conflicting ISRCs', durationMatch: null };
    }
    return { confidence: 1, level: 'isrc', reason: 'identical ISRC', durationMatch: durationsAgree(a, b) };
  }

  const verdict = matchTracks(a, b);

  // A variant disagreement is a hard no. This is the rule that keeps a remix or a
  // live take as its own track.
  if (!verdict.same) {
    const lower = variantReason(a, b);
    if (lower) return { confidence: 0, level: verdict.level, reason: lower, durationMatch: null };
    return { confidence: 0, level: verdict.level, reason: verdict.reason, durationMatch: null };
  }

  const durationMatch = durationsAgree(a, b);

  // Both sides carry a recording id, so provider-native identity already agrees.
  if (idA.level === 'recordingId' && idB.level === 'recordingId') {
    return {
      confidence: 1,
      level: 'recordingId',
      reason: 'identical recording id',
      durationMatch,
    };
  }

  // Title and artist agree after normalisation. Build confidence from how strongly
  // they agree and whether anything else corroborates.
  const titleSim = titleSimilarity(a.title, b.title);
  const artistSim = titleSimilarity(a.artist, b.artist);

  let confidence = 0.62 + titleSim * 0.24 + artistSim * 0.14;

  // An exact normalised title match is stronger evidence than a fuzzy one.
  if (normalizeText(a.title) === normalizeText(b.title)) confidence += 0.08;
  else if (titleSim >= 0.85) confidence += 0.04;

  // Duration is corroboration in both directions. YouTube durations are often
  // rounded or absent, so a mismatch is a warning rather than proof of difference.
  if (durationMatch === true) confidence += 0.08;
  else if (durationMatch === false) confidence -= 0.22;

  // Album agreement helps when the title is generic.
  if (albumsAgree(a, b)) confidence += 0.05;
  else if (a.album && b.album) confidence -= 0.04;

  return {
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(3)))),
    level: 'fuzzy',
    reason: 'normalized title and artist agree',
    durationMatch,
  };
}

/** A specific variant mismatch, or null when the difference is something else. */
function variantReason(a, b) {
  const setA = new Set(variantMarkers(a.title));
  const setB = new Set(variantMarkers(b.title));

  for (const marker of [...setA, ...setB]) {
    if (setA.has(marker) !== setB.has(marker)) {
      return `variant markers disagree (${marker})`;
    }
  }

  return null;
}

/**
 * Whether two durations plausibly describe the same cut.
 *
 * Returns null when either side has no usable duration, which is common on
 * YouTube and must not be read as disagreement.
 */
function durationsAgree(a, b) {
  const durationA = Number(a?.duration);
  const durationB = Number(b?.duration);

  if (!Number.isFinite(durationA) || durationA <= 0) return null;
  if (!Number.isFinite(durationB) || durationB <= 0) return null;

  const delta = Math.abs(durationA - durationB);
  if (delta <= DURATION_TOLERANCE_SECONDS) return true;

  // A proportional tolerance catches a 3:00 vs 3:05 difference on a long track
  // without treating a 3-minute edit of a 6-minute song as the same recording.
  const shorter = Math.min(durationA, durationB);
  return delta / shorter <= DURATION_TOLERANCE_RATIO;
}

/** Album agreement, tolerant of the decorations providers add. */
function albumsAgree(a, b) {
  if (!a?.album || !b?.album) return false;
  return normalizeText(a.album) === normalizeText(b.album);
}

/**
 * Decide what to do with a pair of records.
 *
 * @returns {{action: 'merge'|'link'|'none', confidence: number, reason: string}}
 */
export function relationshipBetween(a, b) {
  const { confidence, reason } = matchConfidence(a, b);

  if (confidence >= MERGE_CONFIDENCE) {
    return { action: 'merge', confidence, reason };
  }

  if (confidence >= LINK_CONFIDENCE) {
    return { action: 'link', confidence, reason };
  }

  return { action: 'none', confidence, reason };
}

/**
 * Find, for one track, the best cross-provider counterpart among candidates.
 *
 * @param {object} track
 * @param {object[]} candidates
 * @returns {{track: object, confidence: number, reason: string}|null}
 */
export function findCounterpart(track, candidates) {
  let best = null;

  for (const candidate of candidates ?? []) {
    // Never match a track against itself.
    if (!candidate || candidate.id === track.id) continue;
    // Same source and same id is a duplicate, not a counterpart.
    if (candidate.source === track.source && candidate.id === track.id) continue;

    const { confidence, reason, level } = matchConfidence(track, candidate);
    if (confidence < LINK_CONFIDENCE) continue;

    if (!best || confidence > best.confidence) {
      best = { track: candidate, confidence, reason, level };
    }
  }

  return best;
}

/**
 * Merge two records known to be the same recording.
 *
 * `primary` wins for display fields — it is the one the user is looking at — while
 * identifiers and metadata are unioned. Playability is a union, so merging a
 * playable YouTube record with Spotify metadata never produces an unplayable track.
 *
 * @param {object} primary
 * @param {object} secondary
 * @returns {object}
 */
export function linkRecords(primary, secondary) {
  const merged = { ...primary };

  // Union identifiers so the result can be matched against either provider later.
  for (const field of ['youtubeId', 'spotifyId', 'musicBrainzId', 'isrc']) {
    if (!merged[field] && secondary?.[field]) merged[field] = secondary[field];
  }

  // Fill metadata gaps only. Display fields stay with the primary record.
  for (const field of ['album', 'albumId', 'releaseDate', 'genres', 'thumbnail']) {
    const empty =
      merged[field] === null ||
      merged[field] === undefined ||
      merged[field] === '' ||
      (Array.isArray(merged[field]) && merged[field].length === 0);

    if (empty && secondary?.[field]) merged[field] = secondary[field];
  }

  // Spotify's release date is precise where YouTube's is absent or vague. Prefer it
  // only when the primary has no date at all; never overwrite a known date.
  if (!merged.releaseDate && secondary?.releaseDate) {
    merged.releaseDate = secondary.releaseDate;
    merged.releaseDatePrecision = secondary.releaseDatePrecision ?? null;
  }

  merged.metadataSources = [
    ...new Set([...(primary.metadataSources ?? []), ...(secondary?.metadataSources ?? [])]),
  ];

  merged.playable = Boolean(primary.playable) || Boolean(secondary?.playable);
  if (!merged.playbackProvider && secondary?.playbackProvider) {
    merged.playbackProvider = secondary.playbackProvider;
  }

  // Cross-links, so a card can navigate to the other provider's version.
  //
  // Same-provider pairs are skipped: an alternate exists to reach a *different*
  // provider, and listing YouTube as an alternate of a YouTube track is noise. The
  // append is deduped because a group can absorb several matches in sequence.
  if (primary.source && secondary?.source && primary.source !== secondary.source) {
    merged.alternates = appendAlternate(merged.alternates, secondary, null);
  }

  return merged;
}

/**
 * Append a counterpart to an alternates list, without duplicates.
 *
 * Dedupe is by source+id rather than by identity, so the same counterpart reached
 * twice through different code paths appears once. Also guards against a record
 * being listed as an alternate of itself, which is meaningless.
 */
function appendAlternate(existing, track, confidence) {
  const list = Array.isArray(existing) ? [...existing] : [];

  if (!track?.id || !track?.source) return list;

  const key = `${track.source}:${track.id}`;
  if (list.some((a) => `${a?.source}:${a?.id}` === key)) return list;

  list.push({
    source: track.source,
    id: track.id,
    url: track.url ?? null,
    ...(confidence !== null ? { confidence } : {}),
  });

  return list;
}

/**
 * Collapse a list of tracks from multiple providers into canonical tracks.
 *
 * Unlike `identity.js`'s `dedupeTracks`, which assumes a single source, this keeps
 * the first (highest-priority) record of each group and attaches the rest as
 * `alternates`, so the frontend can show one card with a provider switch rather
 * than several near-identical cards.
 *
 * @param {object[]} tracks
 * @param {object} [options]
 * @param {string[]} [options.priority] Sources in display-priority order.
 * @returns {{tracks: object[], merged: number}}
 */
export function mergeAcrossProviders(tracks, { priority = ['youtube', 'spotify'] } = {}) {
  const rank = (source) => {
    const index = priority.indexOf(source);
    return index === -1 ? priority.length : index;
  };

  const list = [...(tracks ?? [])].sort((a, b) => rank(a?.source) - rank(b?.source));
  const groups = [];

  for (const track of list) {
    if (!track) continue;

    let placed = false;

    for (const group of groups) {
      const relationship = relationshipBetween(group.primary, track);
      if (relationship.action === 'none') continue;

      // 'link' keeps them separate but attaches the counterpart, so a later pass can
      // still offer the other provider. 'merge' folds the counterpart into one record.
      if (relationship.action === 'merge') {
        group.primary = linkRecords(group.primary, track);
      } else {
        group.primary = {
          ...group.primary,
          alternates: appendAlternate(group.primary.alternates, track, relationship.confidence),
        };
      }

      group.members.push(track);
      placed = true;
      break;
    }

    if (!placed) groups.push({ primary: track, members: [track] });
  }

  return {
    tracks: groups.map((g) => g.primary),
    merged: groups.reduce((sum, g) => sum + g.members.length - 1, 0),
  };
}
