import { trackKey } from './profile.js';

/**
 * Reusable scoring signals.
 *
 * Each returns a 0..1 value so card strategies can weight them explicitly and
 * stay readable as formulae. Every signal distinguishes "no evidence" from
 * "negative evidence": a track with no popularity data is not treated as
 * unpopular, which is what keeps untagged catalogue items from being silently
 * buried.
 */

const DAY_MS = 24 * 3600 * 1000;

/** Linear decay from 1 (just now) to 0 (at `halfLifeDays`). */
export function recencyScore(lastPlayedAt, { halfLifeDays = 14 } = {}, now = Date.now()) {
  if (!lastPlayedAt) return null;

  const ageDays = (now - lastPlayedAt) / DAY_MS;
  if (ageDays < 0) return 1;

  return Math.max(0, 1 - ageDays / halfLifeDays);
}

/**
 * Popularity proxy.
 *
 * `enriched.popularity` is derived from editorial shelf position. When it is
 * absent the signal is null, and callers should treat null as neutral rather
 * than zero.
 */
export function popularityScore(track) {
  const value = track?.enriched?.popularity;
  return typeof value === 'number' ? value : null;
}

/** Fraction of the track the user typically hears before moving on. */
export function completionScore(track, profile) {
  const record = profile?.behaviourFor(track);
  if (!record || typeof record.completionRate !== 'number') return null;
  return Math.max(0, Math.min(1, record.completionRate));
}

/**
 * Skip penalty as a positive signal: 1 means never skipped.
 *
 * Computed from the skip rate rather than the raw count, so a frequently
 * replayed song isn't punished for having many total skips.
 */
export function skipScore(track, profile) {
  const record = profile?.behaviourFor(track);
  if (!record) return null;

  const plays = record.playCount ?? 0;
  if (plays <= 0) return null;

  const rate = (record.skipCount ?? 0) / plays;
  return Math.max(0, 1 - rate);
}

/** How often the user replays this specific track, relative to their max. */
export function replayScore(track, profile) {
  const record = profile?.behaviourFor(track);
  if (!record || !profile.maxReplays) return null;

  return Math.max(0, Math.min(1, (record.replayCount ?? 0) / profile.maxReplays));
}

/** Relative play frequency. */
export function playFrequencyScore(track, profile) {
  const record = profile?.behaviourFor(track);
  if (!record || !profile.maxPlays) return null;

  return Math.max(0, Math.min(1, (record.playCount ?? 0) / profile.maxPlays));
}

/**
 * Affinity for the track's primary artist.
 *
 * Uses the lead artist: a collaboration is credited to whoever leads it,
 * which matches how people describe their listening habits.
 */
export function artistAffinityScore(track, profile) {
  const artist = track?.artist;
  if (!artist) return null;

  return profile?.affinityFor(String(artist).toLowerCase()) ?? 0;
}

/** Mean affinity across the track's genres. */
export function genreAffinityScore(track, profile) {
  const genres = track?.enriched?.genres ?? [];
  if (genres.length === 0) return null;

  const values = genres.map((g) => profile?.genreAffinity(g) ?? 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Mean affinity across the track's moods. */
export function moodAffinityScore(track, profile) {
  const moods = track?.enriched?.moods ?? [];
  if (moods.length === 0) return null;

  const values = moods.map((m) => profile?.moodAffinity(m) ?? 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** The track's language, or null when unknown. */
export function languageOf(track) {
  const language = track?.enriched?.language;
  return language && language !== 'Unknown' ? language : null;
}

/**
 * Novelty: high for unheard tracks, decaying as the user plays them.
 *
 * This is what populates the "discovery" slice of a card.
 */
export function noveltyScore(track, profile) {
  if (!profile?.isPlayed(track)) return 1;

  const record = profile.behaviourFor(track);
  const plays = record?.playCount ?? 1;

  // Once played a lot, novelty has largely expired.
  return Math.max(0, 0.6 - plays * 0.15);
}

/**
 * Blends the personal signals into one user-preference value.
 *
 * Nulls are skipped and the remaining weights are renormalised, so a track with
 * rich metadata competes fairly against one with sparse metadata instead of
 * being punished for missing fields.
 */
export function userPreferenceScore(track, profile) {
  const parts = [
    { value: artistAffinityScore(track, profile), weight: 0.4 },
    { value: genreAffinityScore(track, profile), weight: 0.25 },
    { value: moodAffinityScore(track, profile), weight: 0.2 },
    { value: languageOf(track) ? profile.languageAffinity(languageOf(track)) : null, weight: 0.15 },
  ];

  let total = 0;
  let weight = 0;

  for (const part of parts) {
    if (part.value === null || part.value === undefined) continue;
    total += part.value * part.weight;
    weight += part.weight;
  }

  if (weight === 0) return null;
  return total / weight;
}

/**
 * Weighted sum over named signals, ignoring absent ones.
 *
 * This is the core of the card strategies: each card expresses its formula as
 * a weight table and this applies it, which keeps the weights in one readable
 * place instead of scattered through arithmetic.
 */
export function weightedScore(track, signals, weights) {
  let total = 0;
  let applied = 0;

  for (const [name, weight] of Object.entries(weights)) {
    const value = typeof signals[name] === 'function' ? signals[name]() : signals[name];
    if (value === null || value === undefined || Number.isNaN(value)) continue;

    total += value * weight;
    applied += weight;
  }

  if (applied === 0) return null;

  // Renormalise when signals were missing so the score stays comparable.
  return applied > 0 ? total / applied : null;
}

/** Convenience: does this track already appear in the output? */
export function containsTrack(list, track) {
  const key = trackKey(track);
  return list.some((t) => trackKey(t) === key);
}