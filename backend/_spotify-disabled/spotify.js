import axios from 'axios';
import NodeCache from 'node-cache';

/**
 * Spotify Web API as a *catalog* source.
 *
 * The Spotify Web API never returns audio: there is no stream URL on any
 * endpoint, and the only preview it exposes is a 30-second MP3 for a subset of
 * catalogue entries. So this module is deliberately metadata-only. It fixes the
 * catalogue problems that a YouTube-only backend has — weak Malayalam/Tamil
 * coverage, unreliable artist/album attribution, and no stable IDs — while
 * audio continues to come from YouTube via `lib/audioResolver.js`.
 *
 * Auth is the client-credentials flow, so there is no user login and no
 * `SPOTIFY_ACCESS_TOKEN` to manage. Tokens are cached in-process until shortly
 * before they expire.
 *
 * Endpoint caveats that shape the design below (see the developer changelog):
 *  - Development Mode apps need a Spotify Premium account for the owner.
 *  - `/playlists/{id}/tracks` and other playlist read/write routes return 403
 *    in Development Mode, so shelves are built from `/search` rather than from
 *    playlist endpoints.
 *  - Recommendation and audio-features endpoints are deprecated, so the
 *    in-house recommender in `frontend/src/recommend/` remains the only source
 *    of personalised ranking. Nothing here tries to replace it.
 */

const ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

const http = axios.create({ timeout: 12000 });

// Client-credentials tokens last an hour and have no refresh token, so they are
// held in module scope and reused until shortly before expiry.
let cachedToken = null;
let tokenExpiresAt = 0;
let inFlightToken = null;

// Metadata changes slowly and the quota is shared per developer account, so
// search results and track lookups are cached hard.
const catalogCache = new NodeCache({ stdTTL: 60 * 60 * 6 });

/** True when credentials are present. Every export degrades cleanly when false. */
export function isConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/**
 * The market used for availability filtering and chart-ish results.
 * `IN` is a sensible default for this app's audience and can be overridden.
 */
function market() {
  return process.env.SPOTIFY_MARKET || 'IN';
}

export function status() {
  return {
    configured: isConfigured(),
    market: market(),
    clientIdPresent: Boolean(process.env.SPOTIFY_CLIENT_ID),
    clientSecretPresent: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
  };
}

async function getAccessToken() {
  if (!isConfigured()) {
    throw new Error(
      'Spotify is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env'
    );
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;

  // Collapse concurrent callers onto one token request; a cold start fans out
  // many shelf searches at once and each would otherwise request its own token.
  if (inFlightToken) return inFlightToken;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  inFlightToken = (async () => {
    try {
      const { data } = await http.post(
        ACCOUNTS_URL,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!data?.access_token) throw new Error('Spotify returned no access token');

      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
      return cachedToken;
    } catch (error) {
      // Never cache a failure: the next call should be free to retry.
      cachedToken = null;
      tokenExpiresAt = 0;
      throw new Error(`Spotify auth failed: ${error.message}`);
    } finally {
      inFlightToken = null;
    }
  })();

  return inFlightToken;
}

/**
 * Probe whether the app can actually read the catalogue.
 *
 * Credentials being present says nothing about whether requests are allowed.
 * Spotify gates data access on the app owner's subscription and on app status,
 * so a valid client-credentials token can still be refused on every endpoint.
 * A probe is the only way to tell "not configured" apart from "configured but
 * not permitted", which is otherwise indistinguishable from an empty catalogue.
 *
 * @returns {Promise<{state: string, detail: string|null}>}
 */
export async function diagnose() {
  if (!isConfigured()) {
    return { state: 'not-configured', detail: 'SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set' };
  }

  try {
    const { data } = await http.get(`${API_URL}/search`, {
      params: { q: 'test', type: 'track', limit: 1, market: market() },
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
      timeout: 10000,
    });

    const count = data?.tracks?.items?.length ?? 0;
    return { state: 'ready', detail: `catalogue reachable (${count} result(s) for a probe query)` };
  } catch (error) {
    const status = error.response?.status;

    // Spotify returns these rejections as plain text, not as the usual JSON
    // error envelope, so a string body has to be handled alongside the object.
    const body = error.response?.data;
    const message = String(
      (typeof body === 'string' ? body : body?.error?.message) || error.message || ''
    ).trim();

    // Spotify's wording is the only reliable signal here, so match on substance
    // rather than on an exact string that could change.
    if (status === 403) {
      if (/premium/i.test(message)) {
        return {
          state: 'premium-required',
          detail: 'The Spotify account that owns this app needs an active Premium subscription.',
        };
      }
      return { state: 'forbidden', detail: message || 'Spotify refused the request (403)' };
    }

    if (status === 429) {
      return { state: 'quota-exceeded', detail: 'Development Mode quota exhausted' };
    }

    if (status === 401) {
      return { state: 'credentials-rejected', detail: message || 'Spotify rejected the credentials' };
    }

    return { state: 'unreachable', detail: message || `HTTP ${status ?? 'network error'}` };
  }
}

async function request(path, params = {}) {
  const accessToken = await getAccessToken();

  const { data } = await http.get(`${API_URL}${path}`, {
    params: { market: market(), ...params },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data;
}

/** Largest available artwork, with a mid-size variant for dense grids. */
function pickImage(images) {
  if (!Array.isArray(images) || images.length === 0) return { image: null, imageSmall: null };

  const bySize = [...images].sort((a, b) => (b?.width || 0) - (a?.width || 0));

  return {
    image: bySize[0]?.url || null,
    imageSmall: (bySize.find((entry) => (entry?.width || 0) <= 300) || bySize[1])?.url || null,
  };
}

/**
 * Convert a Spotify track into the frontend's track shape.
 *
 * The shape matches what `lib/youtube.js` produces, so a mixed-source shelf is
 * indistinguishable to the player and the card components. `source: 'spotify'`
 * is what routes playback through the resolver instead of YouTube directly.
 */
export function toTrack(item) {
  if (!item?.id || !item?.name) return null;

  const artists = (item.artists || [])
    .map((artist) => artist?.name)
    .filter(Boolean);

  const { image, imageSmall } = pickImage(item.album?.images);

  return {
    id: item.id,
    title: item.name,
    artist: artists.join(', ') || 'Unknown',
    artists,
    image,
    imageSmall,
    album: item.album?.name || '',
    albumId: item.album?.id || null,
    artistId: item.artists?.[0]?.id || null,
    duration: item.duration_ms ? Math.round(item.duration_ms / 1000) : 0,
    // ISO 639-1. This is what makes regional filtering reliable, since it is
    // declared by the catalogue rather than guessed from a YouTube title.
    language: item.language || null,
    explicit: Boolean(item.explicit),
    popularity: typeof item.popularity === 'number' ? item.popularity : 0,
    isrc: item.external_ids?.isrc || null,
    releaseDate: item.album?.release_date || null,
    url: item.external_urls?.spotify || null,
    source: 'spotify',
  };
}

/** Fetch a single track by Spotify ID. Returns null instead of throwing. */
export async function getTrack(trackId) {
  if (!trackId) return null;

  const key = `track:${trackId}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;

  try {
    const data = await request(`/tracks/${encodeURIComponent(trackId)}`);
    const track = toTrack(data);
    if (track) catalogCache.set(key, track);
    return track;
  } catch (error) {
    console.error('Spotify getTrack error:', error.message);
    return null;
  }
}

/**
 * Search the Spotify catalogue.
 *
 * Returns frontend-shaped tracks, already playable through the resolver. Never
 * throws — an unconfigured or failing Spotify degrades to an empty list so a
 * single bad source cannot take down a page.
 */
export async function search(query, { limit = 20, type = 'track' } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const key = `search:${type}:${market()}:${limit}:${q.toLowerCase()}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;

  try {
    const data = await request('/search', {
      q,
      type,
      limit: Math.min(Number(limit) || 20, 50),
      // Album and playlist results need their own lookup; keep this to tracks,
      // which is the only shape the player can queue.
      include_external: 'audio',
    });

    const items = type === 'track' ? data?.tracks?.items : [];
    const tracks = (items || []).map(toTrack).filter(Boolean);

    // Only cache a non-empty result so a transient outage does not poison the
    // cache for six hours.
    if (tracks.length > 0) catalogCache.set(key, tracks);

    return tracks;
  } catch (error) {
    console.error('Spotify search error:', error.message);
    return [];
  }
}

/**
 * Build editorial shelves from themed Spotify searches.
 *
 * Playlist endpoints are unavailable in Development Mode, so each row is a
 * query rather than a playlist ID. `minPopularity` filters out the long tail of
 * near-zero-scored search results, which otherwise fill regional rows with
 * obscure uploads that have no YouTube match. It can be set per shelf, since
 * regional rows need a stricter cut than a mood row does.
 */
export async function getShelves({ limitPerShelf = 6, shelves = [], minPopularity = 0 } = {}) {
  const usable = shelves.filter((shelf) => shelf?.query);

  const results = await Promise.allSettled(
    usable.map(async (shelf) => {
      const floor = Number.isFinite(shelf.minPopularity) ? shelf.minPopularity : minPopularity;

      // Over-fetch, because the popularity filter runs afterwards and a
      // strict floor can otherwise leave a row short of its target length.
      const found = await search(shelf.query, { limit: Math.min(limitPerShelf * 4, 50) });

      let tracks = found;
      if (floor > 0) {
        tracks = found
          .filter((track) => track.popularity >= floor)
          .sort((a, b) => b.popularity - a.popularity);
      }

      // Deduplicate by ISRC where available: the same recording is frequently
      // returned more than once across album and single releases.
      const seen = new Set();
      const unique = tracks.filter((track) => {
        const dedupeKey = track.isrc || track.id;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });

      return {
        id: shelf.id,
        title: shelf.title,
        kind: shelf.kind || 'album',
        provider: 'spotify',
        tracks: unique.slice(0, limitPerShelf),
      };
    })
  );

  return results
    .filter((result) => result.status === 'fulfilled' && result.value.tracks.length > 0)
    .map((result) => result.value);
}
