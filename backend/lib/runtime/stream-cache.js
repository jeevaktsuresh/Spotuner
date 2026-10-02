/**
 * Resolved stream URL cache.
 *
 * Preserves the Express server's `node-cache` stream cache (6h TTL) and fixes the
 * thing it could not know about: a googlevideo URL carries its own `expire`
 * timestamp, so a cached URL can be dead before its TTL is up. Entries are
 * therefore capped by *both* the configured TTL and the URL's own expiry, minus a
 * margin, so a listener never receives a URL that has just expired.
 *
 * Two tiers, deliberately:
 *
 *   memory  hot path within an isolate, and the only way to coalesce concurrent
 *           resolutions of the same id
 *   KV      shared, so a cold isolate reuses a resolved URL instead of paying the
 *           player round trip again
 *
 * Nothing here is authoritative: `resolveStream()` is always able to produce a
 * fresh URL, and the callers treat a cache read as an optimisation.
 */

import { TtlCache } from './ttl-cache.js';
import * as kv from './kv.js';
import { envNum } from './env.js';

/** Upper bound, matching the original `NodeCache({ stdTTL: 21600 })`. */
const MAX_TTL_MS = 6 * 60 * 60 * 1000;

/** Safety margin so a URL is never handed out within a minute of expiring. */
const EXPIRY_MARGIN_MS = 60_000;

const memory = new TtlCache({ stdTTL: MAX_TTL_MS / 1000, maxKeys: 500 });

const stats = { hits: 0, memoryHits: 0, misses: 0, writes: 0, expired: 0 };

function key(source, id) {
  return `${source}:${id}`;
}

/** KV prefix, namespaced so it cannot collide with the other KV-backed caches. */
function kvKey(source, id) {
  return `stream:${key(source, id)}`;
}

/**
 * How long a URL may still be served.
 *
 * @param {string} url
 * @returns {number} milliseconds, 0 when the URL's own expiry is already too close
 */
function ttlFromUrl(url) {
  let expire = 0;
  try {
    expire = Number(new URL(url).searchParams.get('expire'));
  } catch {
    expire = 0;
  }

  // No parseable expiry: fall back to the configured ceiling rather than trusting
  // the URL indefinitely.
  if (!Number.isFinite(expire) || expire <= 0) return MAX_TTL_MS;

  const remaining = expire * 1000 - Date.now() - EXPIRY_MARGIN_MS;
  if (remaining <= 0) return 0;
  return Math.min(MAX_TTL_MS, remaining);
}

/** Configured ceiling, overridable but never above the original 6 hours. */
function maxTtl() {
  const configured = envNum('SPOTUNER_STREAM_TTL_MS', MAX_TTL_MS);
  return Math.min(Math.max(configured, 0), MAX_TTL_MS);
}

/**
 * Read a cached stream URL.
 *
 * @returns {Promise<string|null>}
 */
export async function get(source, id) {
  const hit = memory.get(key(source, id));
  if (hit) {
    stats.hits += 1;
    stats.memoryHits += 1;
    return hit;
  }

  const stored = await kv.readJson(kv.cache(), kvKey(source, id));
  const url = stored?.url ?? null;

  if (!url) {
    stats.misses += 1;
    return null;
  }

  const ttl = ttlFromUrl(url);
  if (ttl <= 0) {
    // Stored but dead. Drop it rather than hand out an expired URL; the caller
    // resolves a fresh one immediately after.
    stats.expired += 1;
    await kv.remove(kv.cache(), kvKey(source, id));
    stats.misses += 1;
    return null;
  }

  memory.set(key(source, id), url, Math.ceil(ttl / 1000));
  stats.hits += 1;
  return url;
}

/**
 * Cache a resolved stream URL.
 *
 * @param {string} source
 * @param {string} id
 * @param {string} url
 */
export async function set(source, id, url) {
  if (!url) return;

  const ttl = Math.min(ttlFromUrl(url), maxTtl());
  if (ttl <= 0) return;

  memory.set(key(source, id), url, Math.ceil(ttl / 1000));
  stats.writes += 1;

  await kv.writeJson(kv.cache(), kvKey(source, id), { url, storedAt: Date.now() }, ttl);
}

/** Drop one entry, from both tiers. */
export async function invalidate(source, id) {
  memory.del(key(source, id));
  await kv.remove(kv.cache(), kvKey(source, id));
}

/** Drop everything cached for one provider. */
export async function invalidateNamespace(source) {
  for (const cachedKey of memory.keys()) {
    if (cachedKey.startsWith(`${source}:`)) memory.del(cachedKey);
  }
  await kv.indexClear(kv.cache(), `stream:index:${source}`);
}

/** Forget every cached stream. */
export async function clear() {
  memory.flushAll();
}

export function cacheStats() {
  return {
    backend: kv.cache() ? 'kv+memory' : 'memory',
    keys: memory.size,
    ...stats,
  };
}