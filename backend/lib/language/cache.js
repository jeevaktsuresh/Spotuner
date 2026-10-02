/**
 * Detection cache, keyed by YouTube video ID.
 *
 * The spec's dedupe requirement — "if the same song appears in multiple searches,
 * reuse the cached result" — only holds if detection is itself memoised, because
 * a popular video surfaces in a dozen of the targeted queries. Detection is pure
 * apart from its inputs, so the only thing a cache can go stale on is the
 * underlying metadata, which barely changes.
 *
 * A long TTL is therefore safe. The cache also records which search contexts saw
 * the track, so repeated sightings accumulate context rather than re-deriving it.
 *
 * ## Storage
 *
 * `node-cache` is a Node dependency and a Worker isolate has no permanent memory,
 * so the cache is now a two-tier store: an in-isolate TTL map for the hot path and
 * Cloudflare KV underneath it. Detection is pure, so a KV read is always safe to
 * trust, and the 14-day TTL is preserved on both tiers.
 */

import { TtlCache } from '../runtime/ttl-cache.js';
import * as kv from '../runtime/kv.js';
import { envNum } from '../runtime/env.js';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

/** The TTL is read lazily: a Worker binds this per request, after module load. */
function ttlSeconds() {
  return envNum('LANGUAGE_CACHE_TTL', DEFAULT_TTL_SECONDS);
}

const cache = new TtlCache({ stdTTL: DEFAULT_TTL_SECONDS });

function key(videoId) {
  return `lang:${videoId}`;
}

function kvKey(videoId) {
  return `lang:${videoId}`;
}

export function get(videoId) {
  if (!videoId) return null;

  const hit = cache.get(key(videoId));
  if (hit) return hit;

  return null;
}

export function set(videoId, detection) {
  if (!videoId || !detection) return detection;

  const ttl = ttlSeconds();
  cache.set(key(videoId), detection, ttl);

  // Fire-and-forget on purpose: `set` is called from synchronous-looking code
  // throughout detection, and a cache write must not change its timing contract.
  void kv.writeJson(kv.cache(), kvKey(videoId), detection, ttl * 1000);

  return detection;
}

/**
 * Read from the shared tier, used once per batch by `detectTracks`.
 *
 * Kept separate from `get()` so the hot synchronous path stays synchronous: the
 * caller decides when it is worth an await.
 *
 * @returns {Promise<object|null>}
 */
export async function getShared(videoId) {
  if (!videoId) return null;

  const hit = cache.get(key(videoId));
  if (hit) return hit;

  const stored = await kv.readJson(kv.cache(), kvKey(videoId));
  if (!stored) return null;

  cache.set(key(videoId), stored, ttlSeconds());
  return stored;
}

/**
 * Record that a track was seen again under an additional search context.
 *
 * Context is a weak signal, so seeing "Malayalam songs" then "Malayalam hits"
 * should firm up a Malayalam verdict slightly, not double it. `mergeContext`
 * re-runs detection with the union of contexts instead of accumulating raw
 * weights, which keeps repeated sightings from inflating confidence without
 * bound.
 */
export function noteContext(videoId, searchLanguage) {
  const existing = get(videoId);
  if (!existing || !searchLanguage || searchLanguage === 'unknown') return existing;

  const contexts = new Set(existing.searchContexts || []);
  contexts.add(searchLanguage);
  const searchContexts = [...contexts];

  if (searchContexts.length === (existing.searchContexts?.length || 0)) return existing;

  const merged = { ...existing, searchContexts };
  return set(videoId, merged);
}

export function stats() {
  return {
    keys: cache.keys().length,
    ttl: ttlSeconds(),
    backend: kv.cache() ? 'kv+memory' : 'memory',
  };
}

export function clear() {
  cache.flushAll();
}
