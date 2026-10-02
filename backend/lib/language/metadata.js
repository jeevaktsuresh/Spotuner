/**
 * YouTube metadata adapter.
 *
 * The spec puts `snippet.defaultAudioLanguage` at the top of the pipeline with
 * the largest single weight (+50), and that is the correct design — it is the
 * only signal that describes the audio rather than the text.
 *
 * It is not, however, reachable from the source this project actually uses. All
 * catalogue data comes from the InnerTube music endpoint, which carries no
 * language field at all: verified empirically against both the InnerTube search
 * and player endpoints, which return zero language-related keys. yt-dlp exposes
 * a `language` field too, but it is empty for songs.
 *
 * `defaultAudioLanguage` only exists in the YouTube Data API v3, which requires
 * an API key. So this module is a proper adapter that is simply dormant until
 * `YOUTUBE_API_KEY` is set: the moment a key is present, the strongest layer
 * activates with no other code change. Detection runs correctly without it, just
 * with one fewer input.
 *
 * Keeping the layer wired-but-dormant is deliberate. Deleting it would mean
 * re-implementing the pipeline again to use the key later, which is exactly the
 * kind of disabled-but-carried code this project just spent effort removing.
 */

import { createHttp } from '../runtime/http.js';
import { envStr } from '../runtime/env.js';

const http = createHttp({ timeout: 8000 });

/**
 * Whether Data API metadata can be fetched.
 * Surfaced by the debug endpoint so the reason for a missing layer is visible
 * rather than mysterious.
 */
export function isAvailable() {
  return Boolean(envStr('YOUTUBE_API_KEY'));
}

export function unavailableReason() {
  return isAvailable()
    ? null
    : 'YOUTUBE_API_KEY not set — snippet.defaultAudioLanguage unavailable (InnerTube carries no language field)';
}

/** In-process memo so a shelf referencing one video repeatedly costs one call. */
const memo = new Map();

/**
 * Fetch `defaultAudioLanguage` for one video.
 *
 * @returns {Promise<{code: string, raw: string|null}>} `code` is `unknown` when
 *   the video has no declared audio language, which is common and is not an
 *   error — it simply means this layer abstains.
 */
export async function fetchForVideo(videoId) {
  if (!videoId) return { code: 'unknown', raw: null };
  if (memo.has(videoId)) return memo.get(videoId);

  if (!isAvailable()) {
    const empty = { code: 'unknown', raw: null };
    memo.set(videoId, empty);
    return empty;
  }

  try {
    const { data } = await http.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet',
        id: videoId,
        key: envStr('YOUTUBE_API_KEY'),
        maxResults: 1,
      },
    });

    const item = data?.items?.[0];
    const raw = item?.snippet?.defaultAudioLanguage || null;

    const result = { code: raw, raw, description: item?.snippet?.description || '' };
    memo.set(videoId, result);
    return result;
  } catch (error) {
    // A quota error or a bad key must not take down detection: this is one
    // optional input, and the rest of the pipeline still works without it.
    console.error(`YouTube metadata lookup failed for ${videoId}: ${error.message}`);
    const empty = { code: 'unknown', raw: null };
    memo.set(videoId, empty);
    return empty;
  }
}

/**
 * Fetch metadata for many videos at once.
 *
 * The Data API accepts up to 50 ids per call, so a whole shelf costs a couple of
 * requests rather than one per track. Results are returned keyed by video ID so
 * callers can treat a missing entry as "no metadata" without special-casing.
 *
 * @param {string[]} videoIds
 * @returns {Promise<Record<string, {code: string, raw: string|null, description: string}>>}
 */
export async function fetchForVideos(videoIds) {
  const ids = [...new Set((videoIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const results = await Promise.all(chunk.map((id) => fetchForVideo(id)));
    chunk.forEach((id, index) => {
      out[id] = results[index];
    });
  }

  return out;
}
