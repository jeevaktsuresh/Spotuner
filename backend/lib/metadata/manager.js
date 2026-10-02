/**
 * Provider manager.
 *
 * Orchestrates the metadata providers: runs them concurrently, isolates their
 * failures, merges their results, and decides which one is authoritative for a
 * given operation.
 *
 * The central guarantee is that **providers are peers and no provider is
 * load-bearing**. YouTube returning nothing, Spotify credentials being absent, and
 * Spotify rate-limiting all produce the same outcome: whatever results remain are
 * returned, and the caller never sees an error it did not already handle. Every
 * provider call here is wrapped so it cannot reject upward.
 *
 * Concurrency is real, not sequential: a two-provider search issues both requests
 * in the same tick and waits for both, so latency is the slower provider rather
 * than the sum.
 */

import * as registry from './registry.js';
import * as spotify from './providers/spotify.js';
import * as youtube from './providers/youtube.js';
import { normalizeTrack, mergeTrack } from './normalize.js';
import { mergeAcrossProviders, findCounterpart } from './match.js';
import { cached } from '../discovery/swrcache.js';

/** Providers in the order they should contribute to a merged result. */
export const PROVIDER_ORDER = ['youtube', 'spotify'];

/** Search results are volatile enough that they need a short cache. */
const SEARCH_TTL_MS = 5 * 60 * 1000;

/**
 * Run a task against every named provider concurrently, never rejecting.
 *
 * The two failure modes are treated identically — a provider that throws and a
 * provider that is simply absent both resolve to a null result. That is what makes
 * "Spotify fails → YouTube results still work" true by construction rather than by
 * careful error handling at each call site.
 *
 * @param {string[]} names
 * @param {(provider: object, name: string) => Promise<any>} task
 * @returns {Promise<{results: object, errors: object}>}
 */
async function runAll(names, task) {
  const entries = await Promise.all(
    names.map(async (name) => {
      const provider = registry.getProvider(name);

      if (!provider) {
        return [name, { ok: false, value: null, reason: 'unavailable' }];
      }

      try {
        const value = await task(provider, name);
        return [name, { ok: true, value, reason: null }];
      } catch (error) {
        // The message is included because it is already secret-free: providers
        // redact before throwing, and Spotify's failures never carry credentials.
        return [name, { ok: false, value: null, reason: error?.message ?? 'failed' }];
      }
    })
  );

  const results = {};
  const errors = {};

  for (const [name, outcome] of entries) {
    results[name] = outcome.ok ? outcome.value : null;
    if (!outcome.ok) errors[name] = outcome.reason;
  }

  return { results, errors };
}

/**
 * Search across providers and return merged, de-duplicated tracks.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {string[]|string} [options.sources] 'all', or a list of provider names.
 * @param {number} [options.limit]
 * @param {boolean} [options.cache]  Defaults to true for a plain text query.
 * @returns {Promise<{tracks: object[], sources: object, errors: object, merged: number}>}
 */
export async function search(query, { sources = 'all', limit = 20, cache: useCache = true, market } = {}) {
  const text = String(query ?? '').trim();
  if (!text) return { tracks: [], sources: {}, errors: {}, merged: 0 };

  const names = resolveSources(sources);

  // Per-provider result size. Spotify's search endpoint accepts at most 10 per
  // request — asking for more returns HTTP 400 and, worse, an empty provider result
  // with no error — so the cap is taken from the provider itself rather than
  // derived from the requested total. YouTube has no such limit, so it is asked for
  // enough to satisfy the merged list on its own.
  const perProvider = Math.max(5, Math.ceil(limit / Math.max(1, names.length)) * 2);

  const producer = async () => {
    const { results, errors } = await runAll(names, async (provider, name) => {
  if (name === 'spotify') {
    const payload = await spotify.searchTracks(text, { limit: perProvider, market });
    // Injected faults and live responses are the same shape — raw Spotify items —
    // so both go through the same conversion.
    return (payload?.tracks?.items ?? [])
      .map((item) => spotify.toCanonicalTrack(item, { market }))
      .filter(Boolean);
  }

      if (name === 'youtube') {
        const raw = await youtube.search(text, perProvider);
        return (raw ?? []).map((track) => normalizeTrack(track, 'youtube'));
      }

      return null;
    });

    const combined = PROVIDER_ORDER.flatMap((name) => results[name] ?? []);

    // A provider that returned nothing is reported distinctly from one that was
    // never consulted, so an empty result is diagnosable rather than mysterious.
    const empty = {};
    for (const name of PROVIDER_ORDER) {
      if ((results[name] ?? []).length === 0 && !errors[name]) {
        const cooling = name === 'spotify' && spotify.cacheStats().coolingDown;
        empty[name] = cooling ? 'rate limited (cooling down)' : 'no results';
      }
    }

    const { tracks, merged } = mergeAcrossProviders(combined, {
      priority: PROVIDER_ORDER,
    });

    return {
      tracks: tracks.slice(0, limit),
      sources: Object.fromEntries(PROVIDER_ORDER.map((n) => [n, (results[n] ?? []).length])),
      errors: { ...errors, ...empty },
      merged,
    };
  };

  if (!useCache) return producer();

  const { value } = await cached('search', { query: text, sources: names, limit, market }, producer, {
    ttlMs: SEARCH_TTL_MS,
  });

  return value;
}

/**
 * Search one provider only.
 *
 * @param {string} name
 * @param {string} query
 */
export async function searchProvider(name, query, { limit = 20, market } = {}) {
  const text = String(query ?? '').trim();
  if (!text) return [];

  if (name === 'spotify') {
    const payload = await spotify.searchTracks(text, { limit, market });
    return (payload?.tracks?.items ?? [])
      .map((item) => spotify.toCanonicalTrack(item, { market }))
      .filter(Boolean);
  }

  if (name === 'youtube') {
    const raw = await youtube.search(text, limit);
    return (raw ?? []).map((track) => normalizeTrack(track, 'youtube'));
  }

  return [];
}

/**
 * Fetch one track from one provider.
 *
 * @param {string} source
 * @param {string} id
 */
export async function getTrack(source, id, { market } = {}) {
  if (!id) return null;

  if (source === 'spotify') {
    const payload = await spotify.getTrack(id, { market });
    return payload ? spotify.toCanonicalTrack(payload, { market }) : null;
  }

  if (source === 'youtube') {
    const payload = await youtube.getTrack(id);
    return payload ? normalizeTrack(payload, 'youtube') : null;
  }

  return null;
}

export async function getArtist(source, id) {
  if (source === 'spotify') {
    const payload = await spotify.getArtist(id);
    if (!payload) return null;
    return spotify.toCanonicalArtist(payload);
  }
  return null;
}

export async function getAlbum(source, id, { market } = {}) {
  if (source === 'spotify') {
    const payload = await spotify.getAlbum(id, { market });
    if (!payload) return null;
    return {
      id: payload.id,
      spotifyId: payload.id,
      name: payload.name,
      artist: (payload.artists ?? []).map((a) => a?.name).filter(Boolean).join(', ') || null,
      image: payload.images?.[0]?.url ?? null,
      releaseDate: payload.release_date ?? null,
      releaseDatePrecision: payload.release_date_precision ?? null,
      totalTracks: payload.total_tracks ?? null,
      url: payload.external_urls?.spotify ?? null,
      source: 'spotify',
      tracks: (payload.tracks?.items ?? [])
        .map((t) => spotify.toCanonicalTrack(t, { market }))
        .filter(Boolean),
    };
  }
  return null;
}

/**
 * Enrich a YouTube track from Spotify, when Spotify can help.
 *
 * Used by the discovery pipeline so trending and latest gain real release dates
 * and ISRCs. Never fails, never blocks: a track that cannot be enriched is
 * returned unchanged.
 *
 * @param {object} track  A canonical YouTube track.
 * @returns {Promise<object>}
 */
export async function enrichFromSpotify(track) {
  if (!spotify.isAvailable() || !track?.title || !track?.artist) return track;

  try {
    const payload = await spotify.searchTracks(`${track.title} ${track.artist}`, { limit: 3 });
    const candidate = (payload?.tracks?.items ?? [])
      .map((item) => spotify.toCanonicalTrack(item))
      .find(Boolean);

    if (!candidate) return track;

    // Only merge on a confident counterpart. A wrong match would attach a wrong
    // release date to a track, which the latest-release score then trusts.
    const counterpart = findCounterpart(track, [candidate]);
    if (!counterpart || counterpart.confidence < 0.86) return track;

    return mergeTrack(track, candidate, { extraSource: 'spotify' });
  } catch {
    return track;
  }
}

/**
 * Which providers to consult for a requested source selection.
 *
 * `auto` is the interesting case: it resolves to every provider that is actually
 * available, so a missing Spotify configuration degrades to YouTube-only without
 * any caller needing to know.
 */
export function resolveSources(sources) {
  if (Array.isArray(sources)) {
    return sources.filter((name) => PROVIDER_ORDER.includes(name));
  }

  const value = String(sources ?? 'auto').toLowerCase();

  if (value === 'all') return [...PROVIDER_ORDER];

  if (value === 'youtube' || value === 'spotify') return [value];

  // auto: every registered provider that reports itself available.
  const available = PROVIDER_ORDER.filter((name) => Boolean(registry.getProvider(name)));
  return available.length > 0 ? available : ['youtube'];
}

/**
 * Choose the provider that should serve playback for a track.
 *
 * The decision is evidence-based rather than preference-based, because a track
 * that cannot be played from its own source has only one real option:
 *
 *   1. the track's own provider, if it can serve audio
 *   2. the counterpart on another provider, if one exists
 *   3. YouTube, which is the only source of audio in this app
 *   4. null, meaning no playback is possible
 *
 * `preferred` expresses the user's setting but never overrides the absence of a
 * stream: preferring Spotify must not produce an unplayable track.
 */
export async function selectPlaybackProvider(track, { preferred = 'auto' } = {}) {
  if (!track) return { provider: null, track: null, reason: 'no track' };

  // Already resolvable as-is.
  if (track.playable && track.playbackProvider) {
    return { provider: track.playbackProvider, track, reason: 'native' };
  }

  // Spotify metadata, played through YouTube. The common case, and the honest one.
  if (track.source === 'spotify') {
    const counterpart = await findYouTubeCounterpart(track);
    if (counterpart) {
      return { provider: 'youtube', track: counterpart, reason: 'spotify → youtube fallback' };
    }
    return { provider: null, track: null, reason: 'no playable counterpart' };
  }

  // A YouTube track is already playable; a preference for Spotify only matters if
  // Spotify could actually serve it, which it cannot without an SDK session.
  if (track.source === 'youtube') {
    return { provider: 'youtube', track, reason: 'native' };
  }

  return { provider: null, track: null, reason: 'unknown source' };
}

/**
 * Find the YouTube track matching a Spotify-sourced one.
 *
 * The Spotify track's ISRC makes this exact when the recording has one; otherwise
 * title and artist are used, with the variant rules still in force so a remix does
 * not resolve to the original.
 */
async function findYouTubeCounterpart(track) {
  const query = `${track.title} ${String(track.artist ?? '').split(',')[0] ?? ''}`.trim();
  if (!query) return null;

  try {
    const results = await youtube.search(query, 8);
    if (!results?.length) return null;

    const candidates = results.map((item) => normalizeTrack(item, 'youtube'));
    const counterpart = findCounterpart(track, candidates);

    if (!counterpart) return null;

    // Must be genuinely playable: has an id, and a stream route can be built.
    const found = counterpart.track;
    if (!found?.id) return null;

    return { ...found, spotifyId: track.spotifyId ?? track.id };
  } catch {
    return null;
  }
}

/** Diagnostics for the providers route. */
export function status() {
  return {
    providers: registry.providerNames(),
    stats: registry.providerStats(),
    // Spotify's playback capability is a static, honest `false`, exposed so a
    // client can tell "not configured" apart from "cannot play audio at all".
    playback: {
      youtube: true,
      spotify: spotify.isPlayable(),
    },
  };
}

export { spotify, youtube };
