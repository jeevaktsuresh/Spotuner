/**
 * User profile construction.
 *
 * Builds affinities and behavioural statistics from the library plus the richer
 * listening history that `LibraryContext` records. Every signal is normalised
 * 0..1 so card scorers can weight them directly.
 *
 * Confidence is tracked separately from magnitude: ten listens of one song is
 * strong evidence, ten listens of ten different songs is weak evidence about
 * any one of them. `confidenceFor()` lets scorers fade personalisation out
 * until there is enough data to justify it, which is what makes cold start
 * behave predictably.
 */

import { foldForIdentity } from './text.js';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Normalise a count into 0..1 against an observed maximum. */
function ratio(value, max) {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/** Stable identity for a track across sources. */
export function trackKey(track) {
  return `${track?.source ?? 'yt'}:${track?.id ?? track?.title ?? 'unknown'}`;
}

/**
 * Stable identity for an artist.
 *
 * Uses `foldForIdentity` rather than `normalize` so that artists written in a
 * non-Latin script keep distinct keys. `normalize` erases those scripts, which
 * would collapse every Malayalam artist into one key — the diversity cap would
 * then treat a whole regional catalogue as a single artist.
 */
export function artistKey(track) {
  return foldForIdentity(track?.artist);
}

/**
 * How much the system should trust personalisation.
 *
 * Four tiers, matching the spec: cold start, early (<10 plays), learning
 * (10-50), strong (50-200), advanced (200+). Returns a 0..1 weight so scoring
 * stays continuous instead of switching branches.
 */
export function personalisationLevel(totalPlays) {
  if (totalPlays >= 200) return { tier: 'advanced', weight: 1 };
  if (totalPlays >= 50) return { tier: 'strong', weight: 0.8 };
  if (totalPlays >= 10) return { tier: 'learning', weight: 0.5 };
  return { tier: totalPlays > 0 ? 'early' : 'cold', weight: 0.15 };
}

/** Accumulate weighted counts into a normalised affinity map. */
function buildAffinity(entries) {
  const weights = new Map();
  let max = 0;

  for (const { key, weight } of entries) {
    if (!key) continue;
    const next = (weights.get(key) ?? 0) + weight;
    weights.set(key, next);
    if (next > max) max = next;
  }

  const affinity = new Map();
  for (const [key, total] of weights) affinity.set(key, ratio(total, max));

  return { affinity, total: [...weights.values()].reduce((a, b) => a + b, 0) };
}

/**
 * Build the full profile.
 *
 * @param {object} input
 * @param {Array}  input.likedSongs
 * @param {Array}  input.recentlyPlayed
 * @param {Array}  input.history         Rich per-track behaviour records.
 * @param {Array}  input.catalogue       Enriched tracks for context.
 */
export function buildProfile({ likedSongs = [], recentlyPlayed = [], history = [], catalogue = [] } = {}) {
  // ---- Per-track behaviour ------------------------------------------------
  const behaviour = new Map();

  for (const record of history) {
    if (!record?.id) continue;
    behaviour.set(trackKey(record), { ...record });
  }

  // Liked songs are strong evidence even with no play history.
  for (const song of likedSongs) {
    const key = trackKey(song);
    const existing = behaviour.get(key) ?? {};

    behaviour.set(key, {
      ...existing,
      liked: true,
      // Treat a like as a full, completed play when nothing else is recorded.
      playCount: existing.playCount ?? 1,
      completionRate: existing.completionRate ?? 1,
      likedAt: song.likedAt ?? existing.likedAt ?? null,
    });
  }

  // Recently played is a fallback signal when rich history is unavailable.
  const recentWeight = {};
  for (const song of recentlyPlayed) {
    const key = trackKey(song);
    recentWeight[key] = (recentWeight[key] ?? 0) + 1;

    if (!behaviour.has(key)) {
      behaviour.set(key, { playCount: 0, completionRate: 0.5, skipCount: 0, liked: false });
    }
  }

  const records = [...behaviour.values()];

  const totalPlays = records.reduce((sum, r) => sum + (r.playCount ?? 0), 0);
  const totalSkips = records.reduce((sum, r) => sum + (r.skipCount ?? 0), 0);
  const totalReplays = records.reduce((sum, r) => sum + (r.replayCount ?? 0), 0);

  // ---- Affinity dimensions ------------------------------------------------
  // Weight per interaction: a like is the strongest, a skip the weakest.
  const artistEntries = [];
  const genreEntries = [];
  const moodEntries = [];
  const languageEntries = [];
  const hourEntries = [];

  const trackByKey = new Map();
  for (const track of catalogue) trackByKey.set(trackKey(track), track);

  for (const [key, record] of behaviour) {
    const track = trackByKey.get(key);
    if (!track) continue;

    const enriched = track.enriched ?? {};
    const plays = record.playCount ?? 0;
    const liked = record.liked ? 1 : 0;
    const completion = record.completionRate ?? 0.5;
    const skipRate = plays > 0 ? (record.skipCount ?? 0) / plays : 0;

    // Engagement = plays, boosted by completion and likes, reduced by skips.
    let engagement = plays * (0.5 + completion) + liked * 3;
    engagement *= 1 - Math.min(0.8, skipRate);

    if (engagement <= 0) continue;

    artistEntries.push({ key: artistKey(track), weight: engagement });

    for (const genre of enriched.genres ?? []) genreEntries.push({ key: genre, weight: engagement });
    for (const mood of enriched.moods ?? []) moodEntries.push({ key: mood, weight: engagement });

    if (enriched.language && enriched.language !== 'Unknown') {
      languageEntries.push({ key: enriched.language.toLowerCase(), weight: engagement });
    }

    // Time-of-day affinity: listening at night means something for Chill Mix.
    const playedAt = record.lastPlayedAt ?? null;
    if (playedAt) {
      const hour = new Date(playedAt).getHours();
      // 19:00-05:00 wraps past midnight.
      const isEvening = hour >= 19 || hour < 5;
      if (isEvening) hourEntries.push({ key: 'evening', weight: engagement });
    }
  }

  const artists = buildAffinity(artistEntries);
  const genres = buildAffinity(genreEntries);
  const moods = buildAffinity(moodEntries);
  const languages = buildAffinity(languageEntries);
  const hours = buildAffinity(hourEntries);

  // ---- Played / recently played sets --------------------------------------
  const playedKeys = new Set();
  const recentlyPlayedAt = new Map();

  for (const song of recentlyPlayed) {
    const key = trackKey(song);
    playedKeys.add(key);
    recentlyPlayedAt.set(key, song.playedAt ?? 0);
  }

  for (const [key, record] of behaviour) {
    if ((record.playCount ?? 0) > 0) playedKeys.add(key);
    if (record.lastPlayedAt) recentlyPlayedAt.set(key, record.lastPlayedAt);
  }

  // ---- Personalisation state ----------------------------------------------
  const level = personalisationLevel(totalPlays);
  const maxPlays = records.reduce((max, r) => Math.max(max, r.playCount ?? 0), 0);
  const maxReplays = records.reduce((max, r) => Math.max(max, r.replayCount ?? 0), 0);

  /**
   * How much to trust an affinity for `key`, given how little data exists.
   *
   * An affinity built from a single listen should not be treated as equal to
   * one built from fifty. This scales the affinity by its own data weight.
   */
  function confidenceFor(key, dimension = artists) {
    const value = dimension.affinity.get(key) ?? 0;
    const evidence = dimension.total;
    if (evidence <= 0) return 0;

    // Diminishing returns: 1 listen ≈ 0.5, 5 ≈ 0.83, 25 ≈ 0.97.
    const dataConfidence = evidence / (evidence + 4);
    return value * dataConfidence;
  }

  return {
    behaviour,
    trackByKey,
    playedKeys,
    recentlyPlayedAt,

    artists,
    genres,
    moods,
    languages,
    hours,

    totals: {
      plays: totalPlays,
      skips: totalSkips,
      replays: totalReplays,
      liked: likedSongs.length,
      uniqueTracks: behaviour.size,
    },
    level,
    maxPlays,
    maxReplays,
    confidenceFor,
    hasHistory: totalPlays > 0 || likedSongs.length > 0,

    /** Convenience accessors used by the card strategies. */
    affinityFor(key, dimension = artists) {
      return dimension.affinity.get(key) ?? 0;
    },
    genreAffinity(genre) {
      return this.affinityFor(genre, genres);
    },
    moodAffinity(mood) {
      return this.affinityFor(mood, moods);
    },
    languageAffinity(language) {
      return this.affinityFor(String(language).toLowerCase(), languages);
    },
    /** True when the user actually listens in the evening/night. */
    eveningAffinity() {
      return this.affinityFor('evening', hours);
    },
    behaviourFor(track) {
      return this.behaviour.get(trackKey(track)) ?? null;
    },
    isPlayed(track) {
      return this.playedKeys.has(trackKey(track));
    },
    lastPlayedAt(track) {
      return this.recentlyPlayedAt.get(trackKey(track)) ?? null;
    },
    isLiked(track) {
      return Boolean(this.behaviour.get(trackKey(track))?.liked);
    },
    /** Milliseconds since the track was played, or Infinity if never. */
    sinceLastPlay(track, now = Date.now()) {
      const at = this.lastPlayedAt(track);
      return at ? now - at : Number.POSITIVE_INFINITY;
    },
    HOUR_MS,
    DAY_MS,
  };
}

export default buildProfile;