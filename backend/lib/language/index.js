/**
 * Language detection — public entry point.
 *
 * Owns the batching: fetching Data API metadata for a whole shelf in two or
 * three requests instead of one per track, consulting the cache before doing any
 * work, and handing plain evidence to the pure scorer in `detect.js`.
 *
 * `detectTrack` (single) and `detectTracks` (batched) are the only things the
 * rest of the backend should need.
 */

import { detect, WEIGHTS, BANDS, MIN_CONFIDENCE } from './detect.js';
import { normalizeCode, nameOf, codeFromName, UNKNOWN, LANGUAGES } from './languages.js';
import { measureScripts, detectScript } from './script.js';
import * as metadata from './metadata.js';
import * as cache from './cache.js';
import * as debug from './debug.js';
import { logSummary } from './debug.js';

/**
 * Detect one track, using the cache when possible.
 *
 * @param {object} track  A catalogue track: `{ id, title, artist, album? }`.
 * @param {object} [options]
 * @param {string[]} [options.searchContexts] Language codes of queries that found it.
 * @param {boolean} [options.useCache]
 * @returns {object} detection, always with the documented public fields.
 */
export async function detectTrack(track, { searchContexts = [], useCache = true } = {}) {
  if (!track?.id) return detect({ title: track?.title || '', artist: track?.artist || '' });

  if (useCache) {
    const cached = cache.get(track.id);
    if (cached) {
      // A repeat sighting may carry a search context the first one lacked.
      const updated = cache.noteContext(track.id, searchContexts[0]);
      if (updated && updated.searchContexts?.length) {
        return { ...updated, languageDetectionCached: true };
      }
      return { ...cached, languageDetectionCached: true };
    }
  }

  const meta = await metadata.fetchForVideo(track.id);

  const detection = detect({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    description: meta?.description,
    youtubeLanguage: meta?.raw,
    searchContexts,
  });

  cache.set(track.id, detection);
  return { ...detection, languageDetectionCached: false };
}

/**
 * Detect a batch of tracks, fetching metadata in bulk.
 *
 * Sequential by design: `fetchForVideos` already batches to 50 ids per request,
 * and interleaving that with a rate limiter would complicate the code for no
 * measurable gain at shelf scale.
 *
 * @returns {Promise<Array<object>>} detections, in the same order as `tracks`
 */
export async function detectTracks(tracks, { searchContexts = [], useCache = true } = {}) {
  const list = tracks || [];
  if (list.length === 0) return [];

  const results = new Array(list.length);
  const pending = [];

  // Cache first: a cached track needs no metadata request at all. `getShared`
  // rather than `get`, so a cold isolate still benefits from detections another
  // isolate already computed instead of re-detecting the whole shelf.
  await Promise.all(
    list.map(async (track, index) => {
      if (!track?.id || !useCache) {
        pending.push({ track, index });
        return;
      }

      const cached = await cache.getShared(track.id);
      if (cached) {
        const updated = cache.noteContext(track.id, searchContexts[0]);
        results[index] = { ...(updated || cached), languageDetectionCached: true };
      } else {
        pending.push({ track, index });
      }
    }),
  );

  if (pending.length > 0) {
    const meta = await metadata.fetchForVideos(pending.map((p) => p.track?.id).filter(Boolean));

    for (const { track, index } of pending) {
      const info = meta[track?.id] || {};
      const detection = detect({
        id: track?.id,
        title: track?.title,
        artist: track?.artist,
        album: track?.album,
        description: info.description,
        youtubeLanguage: info.raw,
        searchContexts,
      });

      cache.set(track?.id, detection);
      results[index] = { ...detection, languageDetectionCached: false };
    }
  }

  return results;
}

/**
 * Attach detection to a list of tracks as the extra public fields the frontend
 * contract specifies, returning new track objects.
 *
 * The UI then only ever filters on `track.language`; it never inspects a title.
 */
export async function annotate(trackList, options = {}) {
  const tracks = trackList || [];
  if (tracks.length === 0) return [];

  const detections = await detectTracks(tracks, options);

  return tracks.map((track, index) => {
    const d = detections[index] || {};
    return {
      ...track,
      language: d.language || UNKNOWN,
      languageName: d.languageName || nameOf(UNKNOWN),
      languageConfidence: d.languageConfidence ?? 0,
      languageBand: d.languageBand || 'unknown',
      languageDetectionSource: d.languageDetectionSource || [],
      languageConflict: Boolean(d.languageConflict),
      languageDetectionCached: Boolean(d.languageDetectionCached),
    };
  });
}

/** Count detections per language, for the debug endpoint. */
export function summarize(tracks) {
  const counts = {};
  let conflicts = 0;
  let cached = 0;

  for (const track of tracks || []) {
    const code = track?.language || UNKNOWN;
    counts[code] = (counts[code] || 0) + 1;
    if (track?.languageConflict) conflicts += 1;
    if (track?.languageDetectionCached) cached += 1;
  }

  const summary = { total: (tracks || []).length, counts, conflicts, cached };
  logSummary(summary);
  return summary;
}

export {
  WEIGHTS,
  BANDS,
  MIN_CONFIDENCE,
  UNKNOWN,
  LANGUAGES,
  normalizeCode,
  codeFromName,
  nameOf,
  measureScripts,
  detectScript,
  detect as detectPure,
  metadata,
  cache,
  debug,
};

export default { detectTrack, detectTracks, annotate, summarize };
