import { useLibrary } from '../context/LibraryContext';

/**
 * Compact listening summary sent to the backend for personalised discovery.
 *
 * This is the only thing that leaves the device, so it is built deliberately
 * small and coarse:
 *
 *   - normalised affinities, never a listening history
 *   - no track titles, no timestamps, no per-play records
 *   - no identifiers that could reconstruct what someone played
 *
 * The backend needs only relative preference ("this artist 4x that one") to rank a
 * candidate pool, so nothing finer is required — and nothing finer should be sent.
 *
 * Artist keys are split to their lead performer, matching the backend's definition
 * of "the same artist", so a collaboration registers as the artist the listener
 * actually chose.
 */

const SEPARATORS = /\s*(?:&|,|\bx\b(?=\s+\S)|\bfeat\.?\b|\bft\.?\b)\s*/i;

/** The performer a listener means when they say they like an artist. */
export function leadArtistKey(credit) {
  const first = String(credit ?? '')
    .split(SEPARATORS)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return ['unknown', 'various artists', 'various'].includes(first) ? '' : first;
}

/** Accumulate a weight per key into a plain object, capped at `maxKeys`. */
function topKeys(weights, maxKeys) {
  return Object.fromEntries(
    [...weights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeys)
      .map(([key, weight]) => [key, Math.round(weight * 100) / 100])
  );
}

/**
 * Build the payload from library state.
 *
 * @param {object} input
 * @param {Array}  input.likedSongs
 * @param {Array}  input.recentlyPlayed
 * @param {Array}  input.history           Rich per-track behaviour records.
 * @param {Array}  [input.catalogue]      Enriched tracks, for language/genre tags.
 * @returns {object|null} null when there is nothing worth sending.
 */
export function buildProfileSummary({ likedSongs = [], recentlyPlayed = [], history = [], catalogue = [] } = {}) {
  const artistWeights = new Map();
  const languageWeights = new Map();
  const genreWeights = new Map();
  const skipWeights = new Map();
  const playedKeys = new Set();

  const byKey = new Map();
  for (const track of catalogue) {
    const id = track?.id;
    if (id) byKey.set(`${track.source ?? 'yt'}:${id}`, track);
  }

  const bump = (map, key, weight) => {
    if (!key || weight <= 0) return;
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  let totalPlays = 0;

  // --- per-track behaviour -------------------------------------------------
  for (const record of history) {
    if (!record?.id) continue;
    const key = `${record.source ?? 'yt'}:${record.id}`;
    const track = byKey.get(key);

    const plays = record.playCount ?? 0;
    totalPlays += plays;
    if (plays > 0) playedKeys.add(String(record.id).toLowerCase());

    const likes = record.liked ? 1 : 0;
    const completion = record.completionRate ?? 0.5;
    const skips = record.skipCount ?? 0;

    // Skips are positive evidence *against* an artist, and are reported on a
    // separate axis so the backend can subtract rather than merely discount.
    if (skips > 0 && track) {
      const artist = leadArtistKey(track.artist);
      bump(skipWeights, artist, skips / Math.max(1, plays));
    }

    // Engagement mirrors the existing profile model: plays weighted by
    // completion, boosted by a like, reduced by a skip.
    let engagement = plays * (0.5 + completion) + likes * 3;
    if (plays > 0) engagement *= 1 - Math.min(0.8, skips / plays);
    if (engagement <= 0) continue;

    if (track) {
      bump(artistWeights, leadArtistKey(track.artist), engagement);

      const language = String(track.enriched?.language ?? track.language ?? '')
        .toLowerCase()
        .trim();
      if (language && language !== 'unknown') bump(languageWeights, language, engagement);

      for (const genre of track.enriched?.genres ?? track.genres ?? []) {
        bump(genreWeights, String(genre).toLowerCase(), engagement);
      }
    }
  }

  // --- likes are strong evidence even with no play history -----------------
  for (const song of likedSongs) {
    const track = byKey.get(`${song.source ?? 'yt'}:${song.id}`) ?? song;
    totalPlays += song.playCount ?? 1;
    bump(artistWeights, leadArtistKey(track.artist), 6);
    bump(languageWeights, String(track.language ?? track.enriched?.language ?? '').toLowerCase(), 4);
  }

  // --- recently played is a weak fallback -----------------------------------
  for (const song of recentlyPlayed) {
    const track = byKey.get(`${song.source ?? 'yt'}:${song.id}`) ?? song;
    bump(artistWeights, leadArtistKey(track.artist), 1);
    bump(languageWeights, String(track.language ?? track.enriched?.language ?? '').toLowerCase(), 0.5);
    playedKeys.add(String(song.id).toLowerCase());
  }

  const profile = {
    artists: topKeys(artistWeights, 40),
    languages: topKeys(languageWeights, 10),
    genres: topKeys(genreWeights, 20),
    skippedArtists: topKeys(skipWeights, 20),
    playedKeys: [...playedKeys].slice(0, 200),
    totalPlays,
  };

  // Nothing worth sending: an empty profile would only cost a request and
  // produce the same result as omitting it.
  const hasSignal =
    Object.keys(profile.artists).length > 0 || Object.keys(profile.languages).length > 0;

  return hasSignal ? profile : null;
}

/**
 * Hook wrapper, so a component can obtain the summary without knowing how it is
 * built.
 *
 * Kept separate from the fetch hook on purpose: summarising is a pure function of
 * library state, so it is testable without a network or a component tree.
 */
export function useProfileSummary(catalogue = []) {
  const { likedSongs, recentlyPlayed, history } = useLibrary();
  return buildProfileSummary({ likedSongs, recentlyPlayed, history, catalogue });
}

export default buildProfileSummary;
