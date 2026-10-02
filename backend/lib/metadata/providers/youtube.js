/**
 * YouTube metadata provider.
 *
 * A thin adapter over the existing `youtube.js`, expressed in the provider
 * interface. Its real purpose is to make YouTube *one* provider rather than the
 * assumption baked into every call site: after this, nothing outside
 * `lib/metadata/` needs to import `youtube.js` for metadata purposes.
 *
 * Playback is unaffected and still comes from yt-dlp via `youtube.js` — this
 * module never resolves streams.
 */

import * as youtube from '../../youtube.js';
import { normalizeTrack } from '../normalize.js';

export const name = 'youtube';

/** Whether this provider is configured and usable. */
export function isAvailable() {
  return true;
}

/**
 * Whether a YouTube result can be played by this server.
 *
 * True. Stream resolution goes through yt-dlp in `youtube.js` and yields a real
 * progressive URL, so a YouTube-sourced track is playable and Spotify-sourced
 * metadata can be handed to this provider for playback.
 *
 * Stated explicitly because the canonical shape now carries `playable`, and a
 * metadata-only provider must be distinguishable from an audio one.
 */
export function isPlayable() {
  return true;
}

/**
 * Fault injection for tests.
 *
 * ESM namespace objects are frozen, so the provider-failure suites cannot simulate
 * a YouTube outage by patching `search` from a test file. Without this hook the
 * claim "a YouTube outage leaves Spotify metadata working" would be untestable, and
 * an untested failure path is an assumed one.
 *
 * Production never sets it.
 */
let faultInjector = null;

/** @param {((...args: any[]) => any)|null} fn */
export function setFaultInjector(fn) {
  faultInjector = typeof fn === 'function' ? fn : null;
}

/**
 * Search for tracks.
 *
 * @param {string} query
 * @param {number} [limit]
 * @param {object} [options]
 * @param {string} [options.region]  e.g. 'IN'
 * @returns {Promise<object[]>} canonical tracks
 */
export async function search(query, limit = 20, { region } = {}) {
  if (faultInjector) return faultInjector(query, limit, { region });

  const raw = await youtube.search(query, limit, { region });
  return (raw ?? []).map((track) => toCanonical(track));
}

/**
 * Metadata for one track by its video id.
 *
 * @param {string} videoId
 * @returns {Promise<object|null>} canonical track, or null when unknown
 */
export async function getTrack(videoId) {
  if (!videoId) return null;

  const batch = await youtube.getVideoMetadata([videoId]);
  const record = batch?.[videoId];
  if (!record) return null;

  return toCanonical({ id: videoId, title: '', artist: '', ...record });
}

/** Batch form, matching the shape the discovery pipeline already uses. */
export async function getTracks(videoIds) {
  const ids = (videoIds ?? []).filter(Boolean);
  if (ids.length === 0) return {};

  const records = await youtube.getVideoMetadata(ids);
  const out = {};

  for (const id of ids) {
    const record = records?.[id];
    out[id] = record ? toCanonical({ id, title: '', artist: '', ...record }) : null;
  }

  return out;
}

/**
 * Artist lookup.
 *
 * YouTube has no artist entity, so this resolves the credited performers of a
 * track instead. MusicBrainz is the source for real artist identity; this exists
 * so the interface is uniform.
 */
export async function getArtist(artistName) {
  const tracks = await search(`${artistName} songs`, 10);
  return { id: null, name: artistName, source: 'youtube', trackCount: tracks.length, tracks };
}

/** No album entity on YouTube; the best available answer is the tracks. */
export async function getAlbum(albumName) {
  const tracks = await search(`${albumName} album`, 20);
  return { id: null, name: albumName, source: 'youtube', trackCount: tracks.length, tracks };
}

/**
 * Map an existing YouTube search result to the canonical shape.
 *
 * The fields discovery already relies on (`uploadDate`, `releaseDate`,
 * `viewCount`, `likeCount`, `isShortsEligible`, `category`, `description`) are
 * preserved by spreading, because `freshness.js` and `quality.js` read them by
 * those names. The canonical fields are added alongside rather than replacing
 * them, so the existing pipeline keeps working untouched.
 */
function toCanonical(track) {
  const canonical = normalizeTrack(track, 'youtube');

  return {
    ...track,
    ...canonical,
    // Aliases the existing pipeline expects.
    uploadDate: track.uploadDate ?? null,
    viewCount: track.viewCount ?? track.playCount ?? null,
    likeCount: track.likeCount ?? null,
    isShortsEligible: track.isShortsEligible ?? null,
    isLive: track.isLive ?? false,
    // Canonical fields that map onto the existing names.
    publishedAt: canonical.publishedAt,
    views: canonical.views || track.viewCount || track.playCount || 0,

    // A YouTube result is playable once a stream URL is resolved, and this server
    // resolves one. Recorded up front so consumers can tell an audio provider from
    // a metadata-only one without attempting playback first.
    playable: true,
    playbackProvider: 'youtube',
  };
}

export default { name, isAvailable, search, getTrack, getTracks, getArtist, getAlbum };
