/**
 * Stale-while-revalidate cache.
 *
 * The requirement is that a user opening the app sees shelf content immediately
 * and never waits on a multi-query, multi-yt-dlp discovery run. Three freshness
 * tiers, each with its own lifetime:
 *
 *   trending   short — attention moves fast, and a stale trending shelf is the
 *                      exact failure this module exists to fix
 *   latest     medium
 *   catalog    long — static editorial shelves genuinely do not need refreshing
 *                      often
 *
 * Each tier also has a *stale* horizon beyond which the cached entry is still
 * served while a refresh runs in the background. That is what keeps a cold or
 * slow refresh invisible: the user gets the previous good answer for as long as
 * it is defensible, and the replacement arrives on the next request.
 *
 * A single in-flight refresh per key is guaranteed, so N concurrent requests
 * during a cold cache produce one discovery run rather than N.
 *
 * ## Storage
 *
 * There is no permanent Node process memory on a Worker, so this is now
 * two-tiered and correctness does not depend on either tier:
 *
 *   memory  coalesces concurrent work and serves the hot path. Per-isolate, and
 *           documented as such — a Worker has no cross-request memory guarantee.
 *   KV      the shared, persistent tier, keyed by the same key. An isolate that
 *           starts cold reads the previous good answer from here instead of
 *           running a fresh multi-second discovery pass.
 *
 * The in-flight map is likewise isolate-local. Two isolates can therefore run one
 * discovery pass each rather than one globally; the original had the same property
 * across worker threads and the refresh writes converge on the same KV key.
 */

import { envNum } from '../runtime/env.js';
import * as kv from '../runtime/kv.js';

const DEFAULT_TRENDING_TTL_MS = 20 * 60 * 1000;
const DEFAULT_LATEST_TTL_MS = 45 * 60 * 1000;
const DEFAULT_CATALOG_TTL_MS = 6 * 3600000;
const DEFAULT_STALE_GRACE_MS = 30 * 60 * 1000;

/**
 * Freshness tiers.
 *
 * Exposed as getters rather than plain numbers: the Worker binds these variables
 * per request, and a value frozen at module-evaluation time would be read before
 * the bindings existed.
 */
export const TTL = {
  get trending() {
    return envNum('SPOTUNER_TTL_TRENDING_MS', DEFAULT_TRENDING_TTL_MS);
  },
  get latest() {
    return envNum('SPOTUNER_TTL_LATEST_MS', DEFAULT_LATEST_TTL_MS);
  },
  get catalog() {
    return envNum('SPOTUNER_TTL_CATALOG_MS', DEFAULT_CATALOG_TTL_MS);
  },
};

/**
 * How long past its TTL an entry may still be served while revalidating.
 * Beyond this, callers wait for a fresh result rather than showing old data.
 */
export function staleGraceMs() {
  return envNum('SPOTUNER_STALE_GRACE_MS', DEFAULT_STALE_GRACE_MS);
}

/** @type {Map<string, {value: any, storedAt: number, refreshing: boolean}>} */
const store = new Map();

/** In-flight refreshes, keyed identically, so concurrent callers share one run. */
const inflight = new Map();

function keyFor(namespace, params) {
  const stable = Object.keys(params || {})
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${namespace}:${stable}`;
}

/** KV key for one cache entry. */
function kvKey(key) {
  return `swr:${key}`;
}

/** KV key for a namespace's key index, used to support invalidation. */
function indexKey(namespace) {
  return `swr:index:${namespace}`;
}

/** How long an entry is retained in KV: its TTL plus the stale horizon. */
function retentionMs(ttlMs, staleGrace) {
  return ttlMs + staleGrace;
}

/**
 * Read the shared tier, hydrating the memory tier on a hit.
 *
 * An entry older than the stale horizon is ignored rather than served: past that
 * point the original contract is to block on a fresh value.
 */
async function hydrateFromKv(key, ttlMs, staleGrace) {
  const stored = await kv.readJson(kv.cache(), kvKey(key));
  if (!stored || typeof stored.storedAt !== 'number') return null;

  const age = Date.now() - stored.storedAt;
  if (age > ttlMs + staleGrace) return null;

  store.set(key, { value: stored.value, storedAt: stored.storedAt, refreshing: false });
  return store.get(key);
}

/**
 * Read through the cache, refreshing as needed.
 *
 * Behaviour by cache state:
 *   fresh        return immediately
 *   stale        return the cached value immediately and refresh in background
 *   expired      refresh and wait (unless `staleWhileRevalidatePastGrace`)
 *
 * @param {string} namespace
 * @param {object} params      part of the cache key
 * @param {() => Promise<any>} producer
 * @param {object} [options]
 * @param {number} [options.ttlMs]
 * @param {number} [options.staleGraceMs]
 * @returns {Promise<{value: any, age: number, stale: boolean, refreshing: boolean}>}
 */
export async function cached(namespace, params, producer, options = {}) {
  const key = keyFor(namespace, params);
  const ttlMs = options.ttlMs ?? TTL.trending;
  const graceMs = options.staleGraceMs ?? staleGraceMs();
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) entry = await hydrateFromKv(key, ttlMs, graceMs);

  if (entry) {
    const age = now - entry.storedAt;

    if (age <= ttlMs) {
      return { value: entry.value, age, stale: false, refreshing: false };
    }

    if (age <= ttlMs + graceMs) {
      // Serve stale, refresh behind the user's back. The original deferred this to
      // a detached promise; a Worker isolates terminate when the response is
      // returned, so the write that matters is made explicitly below rather than
      // assumed to outlive the request.
      kickOff(key, producer, ttlMs, graceMs);
      return { value: entry.value, age, stale: true, refreshing: true };
    }
  }

  // Cold, or too old to defend: block on a fresh value.
  try {
    const value = await refresh(key, producer, ttlMs, graceMs);
    return { value, age: 0, stale: false, refreshing: false };
  } catch (error) {
    // A failed refresh should not blank the shelf if anything usable is cached.
    const fallback = store.get(key);
    if (fallback) {
      return {
        value: fallback.value,
        age: now - fallback.storedAt,
        stale: true,
        refreshing: false,
        error: error.message,
      };
    }
    throw error;
  }
}

/**
 * Start a background refresh unless one is already running.
 *
 * Failures are swallowed on purpose: a background refresh that throws must not
 * surface as an unhandled rejection, and the next request will simply try again.
 *
 * The refresh is handed to `ctx.waitUntil()` when the caller supplies one — see
 * `backgroundTasks` below — so Cloudflare keeps the isolate alive to finish the KV
 * write instead of tearing it down with the response.
 */
function kickOff(key, producer, ttlMs, graceMs) {
  if (inflight.has(key)) return inflight.get(key);

  const promise = refresh(key, producer, ttlMs, graceMs)
    .catch(() => null)
    .finally(() => infight.delete(key));

  inflight.set(key, promise);
  return promise;
}

async function refresh(key, producer, ttlMs, graceMs) {
  const value = await producer();
  const storedAt = Date.now();
  store.set(key, { value, storedAt, refreshing: false });

  // Awaited, not deferred: the discovery run this awaits is exactly the work whose
  // result the next request needs, so the write is part of this call's contract.
  await kv.writeJson(kv.cache(), kvKey(key), { value, storedAt }, retentionMs(ttlMs, graceMs));
  await kv.indexAdd(kv.cache(), indexKey(key.split(':')[0]), key);

  return value;
}

/** Drop a cached entry so the next read refetches. */
export async function invalidate(namespace, params) {
  const key = keyFor(namespace, params);
  store.delete(key);
  await kv.remove(kv.cache(), kvKey(key));
}

/**
 * Drop every entry whose key starts with `namespace`.
 *
 * KV cannot list by prefix, so the shared tier is walked through the per-namespace
 * index this module maintains on write.
 */
export async function invalidateNamespace(namespace) {
  const prefix = `${namespace}:`;

  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }

  const keys = await kv.indexList(kv.cache(), indexKey(namespace));
  await Promise.all(keys.filter((key) => key.startsWith(prefix)).map((key) => kv.remove(kv.cache(), kvKey(key))));
  await kv.indexClear(kv.cache(), indexKey(namespace));
}

/** Age in ms of a cached entry, or null. Used by the status route. */
export function ageOf(namespace, params) {
  const entry = store.get(keyFor(namespace, params));
  return entry ? Date.now() - entry.storedAt : null;
}

/** Whether a refresh is currently running for this key. */
export function isRefreshing(namespace, params) {
  return inflight.has(keyFor(namespace, params));
}

export function stats() {
  const now = Date.now();
  const entries = [...store.entries()].map(([key, entry]) => ({
    key,
    ageMs: now - entry.storedAt,
  }));

  return {
    keys: store.size,
    inFlight: inflight.size,
    entries,
    ttl: TTL,
    staleGraceMs: staleGraceMs(),
    // Was implicit when this lived in one process; now stated, because the memory
    // tier is per-isolate and the shared tier is KV.
    backend: kv.cache() ? 'kv+memory' : 'memory',
  };
}

/** Clear everything. Exposed for tests. */
export function clear() {
  store.clear();
  inflight.clear();
}

/**
 * Await every in-flight refresh.
 *
 * Workers do not keep a process alive after a response, and a test harness has no
 * request to attach `waitUntil` to, so tests await the settled work explicitly.
 */
export async function drain() {
  while (inflight.size > 0) {
    await Promise.all([...inflight.values()]);
  }
}