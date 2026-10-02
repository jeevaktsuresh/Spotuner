/**
 * Diversity and repetition control.
 *
 * Two separate problems, deliberately not merged:
 *
 *   Per-shelf artist caps  stop a shelf returning six tracks by one artist, which
 *                         is what happens whenever a single song is genuinely
 *                         viral.
 *   Repetition penalty     stop the *same tracks* dominating every section of the
 *                         app, without ever excluding them. Popularity should
 *                         let a song recur, not monopolise.
 *
 * The penalty is deliberately mild. The requirement is to prevent excessive
 * repetition, not to hide popular music, so a heavily-shown track is pushed down
 * the ranking but never removed from consideration.
 */

import { leadArtistName } from '../metadata/identity.js';

/**
 * Recently surfaced tracks, with timestamps.
 *
 * Bounded and time-limited: a track stops being "recent" after `RECENT_WINDOW_MS`
 * regardless of how often it was shown, so a song cannot accumulate a permanent
 * penalty from a single busy afternoon.
 */
const RECENT_WINDOW_MS = 6 * 3600000; // 6 hours
const MAX_TRACKED = 1500;

const recentlyShown = new Map(); // videoId -> { count, lastShownAt }

/** Record that a track was just surfaced. */
export function markShown(videoIds) {
  const now = Date.now();

  for (const id of videoIds || []) {
    if (!id) continue;
    const existing = recentlyShown.get(id);
    recentlyShown.set(id, {
      count: (existing?.count ?? 0) + 1,
      lastShownAt: now,
    });
  }

  if (recentlyShown.size > MAX_TRACKED) {
    // Evict the least recently shown.
    const sorted = [...recentlyShown.entries()].sort((a, b) => a[1].lastShownAt - b[1].lastShownAt);
    for (const [id] of sorted.slice(0, recentlyShown.size - MAX_TRACKED)) {
      recentlyShown.delete(id);
    }
  }
}

/**
 * Multiplier applied to a track's final score, in 0..1.
 *
 * Falls off with both how often and how recently a track was shown:
 *   never shown          -> 1.00
 *   shown once, 5h ago    -> ~0.97
 *   shown 5 times, just now -> ~0.75
 *
 * The floor keeps a track eligible; it is a demotion, not a filter.
 */
const FLOOR = 0.7;

export function repetitionMultiplier(videoId, now = Date.now()) {
  const entry = recentlyShown.get(videoId);
  if (!entry) return 1;

  const ageMs = now - entry.lastShownAt;
  if (ageMs > RECENT_WINDOW_MS) return 1;

  // Recency of the *last* showing, 0..1 over the window.
  const freshness = 1 - ageMs / RECENT_WINDOW_MS;

  // Count saturates so one track cannot be pushed out entirely.
  const countFactor = Math.min(entry.count, 5) / 5;

  const penalty = 0.3 * countFactor * freshness;
  return Math.max(FLOOR, 1 - penalty);
}

/**
 * Split a ranked list so no artist dominates it.
 *
 * Walks the ranking and defers a track whose artist is already over the cap,
 * then appends the deferred tracks at the end rather than discarding them. That
 * keeps a shelf full even when the pool is dominated by one artist, which is the
 * requirement — the cap is a preference, not an exclusion.
 *
 * @param {object[]} ranked  scored tracks, best first
 * @param {object} [options]
 * @param {number} [options.maxPerArtist]
 * @param {string[]} [options.excludeIds]  artist keys to treat as already used
 */
export function applyArtistDiversity(ranked, { maxPerArtist = 2, excludeIds = [] } = {}) {
  const counts = new Map();
  const taken = [];
  const deferred = [];

  // Artists already represented by an earlier shelf start with their quota
  // partly spent, so a second section does not re-run the same artist.
  const used = new Set(excludeIds);

  for (const track of ranked) {
    // The lead artist is what "the same artist" means here; collaborators and
    // compilations should not consume another artist's quota.
    //
    // Uses the shared splitter rather than a local regex. The previous inline
    // pattern wrapped its separators in optional whitespace, so the bare "x"
    // matched inside any name containing that letter — "Max" became "Ma" and
    // "Alex Paul" became "Ale", which silently broke this cap.
    const artistKey = leadArtistName(track.artist);

    if (!artistKey || artistKey === 'unknown') {
      taken.push(track);
      continue;
    }

    const usedByOthers = used.has(artistKey) ? 1 : 0;
    const count = (counts.get(artistKey) ?? 0) + usedByOthers;

    if (count < maxPerArtist) {
      counts.set(artistKey, count + 1);
      taken.push(track);
    } else {
      deferred.push(track);
    }
  }

  return [...taken, ...deferred];
}

/** How many times a track has been shown recently. For diagnostics. */
export function shownCount(videoId) {
  return recentlyShown.get(videoId)?.count ?? 0;
}

/** Clear all repetition state. Exposed for tests. */
export function resetRepetition() {
  recentlyShown.clear();
}

export function repetitionStats() {
  const now = Date.now();
  let inWindow = 0;
  for (const entry of recentlyShown.values()) {
    if (now - entry.lastShownAt <= RECENT_WINDOW_MS) inWindow += 1;
  }
  return { tracked: recentlyShown.size, inWindow, windowMs: RECENT_WINDOW_MS };
}