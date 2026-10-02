/**
 * Spotify Web API service — server-side only.
 *
 * Scopes, and deliberately not:
 *
 *   Metadata only. The Spotify Web API does not license audio for third-party
 *   playback, so nothing here can make a track playable. Every function returns
 *   catalog data. Treating a Spotify result as playable would be a lie, and
 *   `getPlayableTrack` exists precisely so callers cannot do that by accident.
 *
 *   No user scopes. No Authorization Code flow, no refresh tokens, no user profile,
 *   no saved library. The client-credentials grant is sufficient for everything
 *   this app asks of Spotify and requests the least privilege that works.
 *
 * Two constraints shaped this module:
 *
 *   1. **Credentials are read lazily, inside functions.** Not at module scope.
 *      ESM evaluates every import before the importing module's body runs, so
 *      `server.js`'s `dotenv.config()` happens *after* this module is evaluated —
 *      a top-level `process.env.SPOTIFY_CLIENT_ID` would reliably be undefined.
 *      This was verified empirically rather than assumed. On a Worker the same
 *      rule applies for a different reason: bindings do not exist at module
 *      evaluation time either, so `credentials()` reads them from the runtime env
 *      layer on every call.
 *
 *   2. **The secret never leaves this file.** It is used to build one Basic auth
 *      header and is never returned, logged, echoed in an error, or attached to a
 *      response. `redact()` scrubs it from anything that might be surfaced.
 */

import { createHttp } from '../../runtime/http.js';
import * as kv from '../../runtime/kv.js';
import { envNum, envStr } from '../../runtime/env.js';
import { normalizeTrack } from '../normalize.js';
import { normalizeText } from '../identity.js';

export const name = 'spotify';

const AUTH_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

const http = createHttp({ timeout: 8000 });

/**
 * Maximum `limit` Spotify accepts on `/search` for a single type.
 *
 * Measured against the live API rather than taken from the documentation, which
 * claims 50. Track searches answer HTTP 400 "Invalid limit" for anything above 10,
 * which is far more restrictive than the reference implies:
 *
 *   limit=10 -> 200, limit=20 -> 400, limit=21 -> 400, limit=50 -> 400
 *
 * Getting this wrong is silent rather than loud. The request fails, the provider
 * reports no results and no error, and a multi-source search returns YouTube only
 * while appearing to work — which is exactly what happened before this was pinned.
 *
 * Paging is the only way to exceed it, via `offset`.
 */
const SEARCH_LIMIT_MAX = 10;

/**
 * Clamp a search limit to what the endpoint will actually accept.
 *
 * @param {number} limit
 * @returns {number}
 */
function clampSearchLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return SEARCH_LIMIT_MAX;
  return Math.min(Math.max(Math.round(n), 1), SEARCH_LIMIT_MAX);
}

/**
 * Token cache.
 *
 * Spotify tokens last an hour, and issuing one per API call would both waste the
 * rate limit and look like abuse. The expiry is stored with a safety margin so a
 * token is never used in the moments before it actually expires.
 */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

let cachedToken = null;
let tokenExpiresAt = 0;

/** Refresh coalescing: concurrent callers share one in-flight token request. */
let inFlightToken = null;

/**
 * Rate-limit stand-down.
 *
 * Spotify answers 429 under sustained load. Observed directly: a burst of searches
 * mid-session started returning empty results with no error, because `apiGet`
 * reports a 429 as "no data" and the multi-source path then silently served
 * YouTube only. Worse, the next request would usually 429 again, so the provider
 * kept contributing nothing for as long as the caller kept asking.
 *
 * After a 429 every request fails fast without touching the network until this
 * expires, which both stops the bleeding and gives the quota time to recover.
 *
 * The cooldown honours Spotify's own `Retry-After` header. Measured directly, a
 * quota exhaustion returns `retry-after: 83970` — around 23 hours — with the body
 * `QUOTA_EXCEEDED`. A fixed 30s cooldown would have hammered the API thousands of
 * times over that window for no benefit, so the server's stated answer is used and
 * the local default is only a floor.
 */
let rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = () => envNum('SPOTUNER_SPOTIFY_COOLDOWN_MS', 30_000);

/** Longest cooldown honoured, so a malformed or hostile header cannot disable us. */
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * How long to rest after a 429.
 *
 * `Retry-After` is either seconds or an HTTP date; both are accepted, and an
 * unparseable or absurd value falls back to the local default rather than trusting
 * it.
 */
function cooldownFrom(error) {
  const header = error?.response?.headers?.['retry-after'];
  const fallback = RATE_LIMIT_COOLDOWN_MS();

  if (!header) return fallback;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_COOLDOWN_MS);
  }

  const asDate = new Date(header).getTime();
  if (Number.isFinite(asDate)) {
    const wait = asDate - Date.now();
    if (wait > 0) return Math.min(wait, MAX_COOLDOWN_MS);
  }

  return fallback;
}

/**
 * Cooldown state, persisted.
 *
 * A spent quota can last a day, and the token cache in this module is in-memory, so
 * a backend restart would forget the stand-down and immediately start consuming
 * requests that are guaranteed to fail. Persisting the deadline means a restart
 * during a long cooldown stays quiet — and on a Worker, where an isolate can be
 * discarded at any moment and there is no filesystem at all, the shared tier is the
 * only place this can live.
 */
const STATE_KEY = 'state:spotify';

async function persistCooldown() {
  await kv.writeJson(kv.cache(), STATE_KEY, { rateLimitedUntil: rateLimitedUntil || null }, 24 * 60 * 60 * 1000);
}

async function restoreCooldown() {
  try {
    const saved = await kv.readJson(kv.cache(), STATE_KEY);
    const until = Number(saved?.rateLimitedUntil);
    // Only honour a deadline that is still in the future.
    if (Number.isFinite(until) && until > Date.now()) rateLimitedUntil = until;
  } catch {
    // No state, or unreadable. Start unthrottled.
  }
}

/**
 * Restore the persisted stand-down once per isolate.
 *
 * Deferred to the first API call rather than run at module load: a Worker has no
 * bindings during module evaluation, so there would be nothing to read.
 */
let cooldownRestored = false;
function ensureCooldownRestored() {
  if (cooldownRestored) return;
  cooldownRestored = true;
  void restoreCooldown();
}

/** Probe counters, surfaced on the providers route for diagnostics. */
const stats = {
  tokenRequests: 0,
  tokenCacheHits: 0,
  authFailures: 0,
  requests: 0,
  rateLimited: 0,
  errors: 0,
};

/**
 * Read credentials from the environment, at call time.
 *
 * Never cache the result. Caching would reintroduce the module-load ordering bug
 * this design exists to avoid, and it would keep the secret resident in memory for
 * the life of the process.
 */
function credentials() {
  return {
    id: envStr('SPOTIFY_CLIENT_ID'),
    secret: envStr('SPOTIFY_CLIENT_SECRET'),
  };
}

/** Whether credentials are configured. Never reveals their value. */
export function isAvailable() {
  const { id, secret } = credentials();
  return Boolean(id && secret);
}

/**
 * Whether a usable token has already been obtained.
 *
 * Distinct from `isAvailable()`: credentials may be present while authentication
 * is failing (a revoked secret, an outage). Callers that need certainty should
 * await `getAccessToken()`.
 */
export function isAuthenticated() {
  return Boolean(cachedToken) && Date.now() < tokenExpiresAt;
}

/**
 * Obtain an access token, reusing the cached one until it nears expiry.
 *
 * Concurrent callers share a single request, so a burst of parallel discovery
 * queries does not turn into a burst of token requests.
 *
 * @returns {Promise<string|null>} token, or null when unavailable
 */
export async function getAccessToken() {
  if (isAuthenticated()) {
    stats.tokenCacheHits += 1;
    return cachedToken;
  }

  if (inFlightToken) return inFlightToken;

  inFlightToken = requestToken().finally(() => {
    inFlightToken = null;
  });

  return inFlightToken;
}

async function requestToken() {
  const { id, secret } = credentials();

  if (!id || !secret) {
    stats.authFailures += 1;
    return null;
  }

  stats.tokenRequests += 1;

  try {
    const { data } = await http.post(
      AUTH_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!data?.access_token) {
      stats.authFailures += 1;
      return null;
    }

    cachedToken = data.access_token;
    // `expires_in` is seconds. Absent or implausible values are treated as an
    // hour rather than trusted, so a malformed response cannot pin the token.
    const seconds = Number(data.expires_in);
    const lifetimeMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 3_600_000;

    tokenExpiresAt = Date.now() + Math.max(0, lifetimeMs - TOKEN_SAFETY_MARGIN_MS);

    return cachedToken;
  } catch {
    // A failed token request must never surface its detail; the reason may
    // reference the credentials.
    stats.authFailures += 1;
    cachedToken = null;
    tokenExpiresAt = 0;
    return null;
  }
}

/**
 * Authenticated GET against the Spotify API.
 *
 * Retries once on a 401, because a token can expire between the cache check and
 * the request. Never throws for an expected API condition — the caller gets null
 * and the rest of the pipeline continues.
 *
 * @returns {Promise<object|null>}
 */
async function apiGet(path, params) {
  ensureCooldownRestored();

  // In cooldown: fail fast rather than spend a request we know will be refused.
  if (Date.now() < rateLimitedUntil) {
    stats.rateLimited += 1;
    return null;
  }

  const token = await getAccessToken();
  if (!token) return null;

  try {
    stats.requests += 1;
    const { data } = await http.get(`${API_BASE}${path}`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401) {
      // The token was revoked or expired early. Drop it and try exactly once.
      cachedToken = null;
      tokenExpiresAt = 0;
      const retryToken = await getAccessToken();
      if (!retryToken) return null;

      try {
        stats.requests += 1;
        const { data } = await http.get(`${API_BASE}${path}`, {
          params,
          headers: { Authorization: `Bearer ${retryToken}` },
        });
        return data;
      } catch {
        stats.errors += 1;
        return null;
      }
    }

    if (status === 429) {
      // Rest for as long as Spotify says, rather than a fixed guess.
      stats.rateLimited += 1;
      rateLimitedUntil = Date.now() + cooldownFrom(error);
      void persistCooldown();
    } else {
      stats.errors += 1;
    }

    return null;
  }
}

// ===== Catalog reads ========================================================

/**
 * Search tracks.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit]
 * @param {string} [options.market] ISO country, affects availability results
 * @returns {Promise<object|null>} raw Spotify payload, or null
 */
export async function searchTracks(query, { limit = 20, market } = {}) {
  if (!query) return null;

  if (faultInjector) {
    // Stands in for the upstream API, so it returns raw Spotify items that every
    // caller converts with `toCanonicalTrack` just as it would a live response.
    return { tracks: { items: (await faultInjector({ title: query, artist: '', mode: 'search' })) ?? [] } };
  }

  return apiGet('/search', {
    q: query,
    type: 'track',
    limit: clampSearchLimit(limit),
    ...(market ? { market } : {}),
  });
}

/** Search artists. */
export async function searchArtists(query, { limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet('/search', {
    q: query,
    type: 'artist',
    limit: clampSearchLimit(limit),
    ...(market ? { market } : {}),
  });
}

/** Search albums. */
export async function searchAlbums(query, { limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet('/search', {
    q: query,
    type: 'album',
    limit: clampSearchLimit(limit),
    ...(market ? { market } : {}),
  });
}

/**
 * Several search types in one request.
 *
 * Spotify charges the same rate limit for a combined query as for a single type,
 * so this is both cheaper and more consistent than issuing one call per type.
 */
export async function search(query, { types = ['track'], limit = 20, market } = {}) {
  if (!query) return null;
  return apiGet('/search', {
    q: query,
    type: types.join(','),
    limit: clampSearchLimit(limit),
    ...(market ? { market } : {}),
  });
}

/** One track. */
export async function getTrack(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/tracks/${encodeURIComponent(id)}`, market ? { market } : undefined);
}

/** One album, including its tracks. */
export async function getAlbum(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/albums/${encodeURIComponent(id)}`, market ? { market } : undefined);
}

/** One artist. */
export async function getArtist(id) {
  if (!id) return null;
  return apiGet(`/artists/${encodeURIComponent(id)}`);
}

/** An artist's top tracks. Used as a discovery candidate source. */
export async function getArtistTopTracks(id, { market = 'IN', limit = 20 } = {}) {
  if (!id) return null;
  return apiGet(`/artists/${encodeURIComponent(id)}/top-tracks`, {
    market,
    limit: clampSearchLimit(limit),
  });
}

/** One playlist and its tracks. */
export async function getPlaylist(id, { market } = {}) {
  if (!id) return null;
  return apiGet(`/playlists/${encodeURIComponent(id)}`, market ? { market } : {} );
}

/** Spotify's own "new releases" feed, as a Latest candidate source. */
export async function getNewReleases({ country = 'IN', limit = 50 } = {}) {
  const data = await apiGet('/browse/new-releases', { country, limit });
  return data?.albums?.items ?? null;
}

/** Recently played is a user-scoped endpoint and is intentionally not used. */

// ===== Playback ============================================================

/**
 * Whether this track can be played *by this server*.
 *
 * Always false, and that is the accurate answer rather than a placeholder.
 *
 * The Spotify Web API does not expose an audio stream endpoint for third-party
 * use. Playback is only possible through the Web Playback SDK, which needs an
 * interactive user login on a Premium account and runs in the browser — so it
 * cannot be decided here, and guessing would produce tracks that fail at the
 * moment the listener presses play.
 *
 * Callers must therefore treat a Spotify result as metadata and resolve playback
 * through another provider.
 */
export function isPlayable() {
  return false;
}

export function cacheStats() {
  return {
    configured: isAvailable(),
    authenticated: isAuthenticated(),
    // Deliberately no token value, and no secret.
    tokenExpiresAt: tokenExpiresAt || null,
    // Lets a caller tell "Spotify is resting after a 429" apart from "Spotify
    // returned nothing", which otherwise look identical.
    coolingDown: Date.now() < rateLimitedUntil,
    cooldownEndsAt: rateLimitedUntil || null,
    probes: { ...stats },
  };
}

export function clearCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
  inFlightToken = null;
  rateLimitedUntil = 0;
  stats.tokenRequests = 0;
  stats.tokenCacheHits = 0;
  stats.authFailures = 0;
  stats.requests = 0;
  stats.rateLimited = 0;
  stats.errors = 0;
}

/**
 * Remove the client secret from any string, for safe logging.
 *
 * Cheap insurance. Error paths in this module already avoid the credentials, but
 * a future caller passing an axios error object to a logger should not be able to
 * leak them by accident.
 */
export function redact(value) {
  const { secret } = credentials();
  let text = typeof value === 'string' ? value : String(value ?? '');

  if (secret) {
    text = text.split(secret).join('[REDACTED]');
    // Also cover the base64 form, which is what actually travels on the wire.
    const encoded = Buffer.from(secret).toString('base64');
    text = text.split(encoded).join('[REDACTED]');
  }

  return text;
}

// ===== Normalisation =======================================================

/**
 * Convert a Spotify track into the canonical Spotuner shape.
 *
 * Spotify's data is unusually clean — real album names, real release dates, real
 * ISRCs, consistent durations — which makes it a genuinely useful enrichment
 * source for exactly the fields YouTube does not have.
 *
 * `playable` is false and `playbackProvider` is null. That is not pessimism: the
 * Web API serves no audio, so a "playable" Spotify track would fail at the press.
 */
export function toCanonicalTrack(item, { market } = {}) {
  if (!item || !item.id) return null;

  const album = item.album ?? null;
  const artists = (item.artists ?? []).map((a) => a?.name).filter(Boolean);

  // Spotify's `external_ids` carries an ISRC when one is registered. This is the
  // single most valuable field here: it is a stable identifier for one specific
  // recording, which is what lets a Spotify result be matched to a YouTube upload
  // without guessing from the title.
  const isrc = album?.external_ids?.isrc ?? item.external_ids?.isrc ?? null;

  // `release_date_precision` distinguishes a day, a month, or a year. A year-only
  // date is not precise enough to score a "latest releases" shelf on its own, so
  // it is recorded and the consumer decides.
  const releaseDate = item.release_date ?? album?.release_date ?? null;
  const precision = item.release_date_precision ?? album?.release_date_precision ?? null;

  return {
    ...normalizeTrack(
      {
        id: item.id,
        source: 'spotify',
        spotifyId: item.id,
        title: item.name,
        artist: artists.join(', ') || 'Unknown',
        album: album?.name ?? null,
        albumId: album?.id ?? null,
        duration: Number.isFinite(item.duration_ms) ? Math.round(item.duration_ms / 1000) : 0,
        image: pickImage(item.album?.images ?? item.images),
        releaseDate,
        isrc,
        genres: [],
        url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
      },
      'spotify'
    ),

    releaseDatePrecision: precision,
    spotifyPopularity: Number.isFinite(item.popularity) ? item.popularity : null,
    externalUrls: item.external_urls ?? {},
    explicit: Boolean(item.explicit),

    // Not playable through this server. See `isPlayable`.
    playable: false,
    playbackProvider: null,
  };
}

/** Spotify returns images largest-last; the widest is the right pick for cards. */
function pickImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return [...images].sort((a, b) => (b?.width ?? 0) - (a?.width ?? 0))[0]?.url ?? null;
}

/**
 * Convert an artist, used for attribution and for enrichment of artist-level
 * fields the catalogue does not otherwise carry.
 */
export function toCanonicalArtist(item) {
  if (!item || !item.id) return null;
  return {
    id: item.id,
    spotifyId: item.id,
    name: item.name,
    genres: item.genres ?? [],
    followers: item.followers?.total ?? null,
    image: pickImage(item.images),
    url: item.external_urls?.spotify ?? `https://open.spotify.com/artist/${item.id}`,
    source: 'spotify',
  };
}

/**
 * Fault injection for tests.
 *
 * ESM namespace objects are frozen, so the failure suites cannot simulate a
 * Spotify outage by patching this module's functions. The guarantee "a Spotify
 * failure never breaks the app" is only worth as much as its test, and the test is
 * only possible if there is a seam.
 *
 * Production never sets it.
 */
let faultInjector = null;

/** @param {((query: object) => any)|null} fn */
export function setFaultInjector(fn) {
  faultInjector = typeof fn === 'function' ? fn : null;
}

/**
 * Enrichment entry point used by the discovery pipeline.
 *
 * Named distinctly from `getTrack(id)` because the two answer different questions:
 * one is an id lookup, the other is "what does Spotify know about this
 * title/artist pair". Sharing a name would make the caller's intent ambiguous and
 * invites passing an object where an id is expected.
 *
 * Returns the best candidate without verifying it against the caller — matching is
 * the manager's job, since only the manager knows what the YouTube record looks
 * like.
 *
 * @param {{title: string, artist: string, market?: string}} query
 * @returns {Promise<object|null>} canonical track, or null
 */
export async function enrichByText({ title, artist, market } = {}) {
  if (!title || !artist) return null;

  const payload = await searchTracks(`${title} ${artist}`, { limit: 3, market });
  const items = payload?.tracks?.items ?? [];

  // An injected fault stands in for the *upstream API*, so its items are raw
  // Spotify payloads and still need converting — exactly as a live response does.
  // Letting them through unconverted produced objects with no title at all, which
  // silently defeated enrichment in every failure-path test.
  const candidates = items.map((item) => toCanonicalTrack(item, { market })).filter(Boolean);

  if (candidates.length === 0) return null;

  // Prefer the candidate whose title and artist actually match the query, since
  // Spotify's search ranking will happily return a different song by the same act.
  const wanted = normalizeText(`${title} ${artist}`);
  const exact = candidates.find((c) => normalizeText(`${c.title} ${c.artist}`) === wanted);

  return exact ?? candidates[0];
}

export default {
  name,
  isAvailable,
  isAuthenticated,
  getAccessToken,
  search,
  searchTracks,
  searchArtists,
  searchAlbums,
  getTrack,
  enrichByText,
  getAlbum,
  getArtist,
  getArtistTopTracks,
  getPlaylist,
  getNewReleases,
  isPlayable,
  toCanonicalTrack,
  toCanonicalArtist,
  cacheStats,
  clearCache,
  redact,
};
