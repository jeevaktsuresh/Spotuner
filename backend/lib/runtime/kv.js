/**
 * Cloudflare KV access.
 *
 * Everything that used to live in a file or in `node-cache` needs a home now that
 * the backend is a Worker. Two namespaces, split by access pattern rather than by
 * data type:
 *
 *   CACHE          short/medium-lived derived data: discovery results, search
 *                  merges, resolved stream URLs, language detections, hydrated
 *                  video metadata, hero images, provider cooldown state.
 *   ARTIST_IMAGES  the iTunes artist-image catalogue. It grows monotonically and
 *                  is bulk-listed / imported, which is exactly the shape KV wants
 *                  isolated from the hot cache.
 *
 * Under Node there are no bindings, so every accessor returns null and the
 * affected modules fall back to in-memory state. That is what keeps the Express
 * fallback server and the CLI test suites working with no shims.
 */

/**
 * @typedef {object} KVNamespaceLike
 * @property {(key: string, options?: any) => Promise<any>} get
 * @property {(key: string, value: string, options?: any) => Promise<any>} put
 * @property {(key: string) => Promise<any>} delete
 */

/** @type {Record<string, KVNamespaceLike|null>} */
let namespaces = {};

/** Binding names per logical namespace. First match wins. */
const BINDINGS = {
  CACHE: ['CACHE', 'SPOTUNER_CACHE'],
  ARTIST_IMAGES: ['ARTIST_IMAGES', 'SPOTUNER_ARTIST_IMAGES'],
};

/**
 * Install the request's KV bindings.
 *
 * @param {Record<string, any>} env
 */
export function installKv(env) {
  const next = {};
  for (const [logical, candidates] of Object.entries(BINDINGS)) {
    next[logical] = null;
    for (const candidate of candidates) {
      if (env && env[candidate] && typeof env[candidate].get === 'function') {
        next[logical] = env[candidate];
        break;
      }
    }
  }
  namespaces = next;
}

/** Forget installed bindings. Used by tests. */
export function resetKv() {
  namespaces = {};
}

/** @returns {KVNamespaceLike|null} */
export function cache() {
  return namespaces.CACHE ?? null;
}

/** @returns {KVNamespaceLike|null} */
export function artistImages() {
  return namespaces.ARTIST_IMAGES ?? null;
}

/** Which namespaces are bound, for the status routes. Never values or ids. */
export function bindingsInfo() {
  return {
    CACHE: Boolean(namespaces.CACHE),
    ARTIST_IMAGES: Boolean(namespaces.ARTIST_IMAGES),
  };
}

/** KV refuses `expirationTtl` below 60 seconds. */
export const MIN_KV_TTL_SECONDS = 60;

/**
 * Convert a millisecond TTL to a KV-safe one.
 *
 * Values below the 60-second floor are clamped rather than dropped, because
 * dropping the option turns a TTL into "never expires" — the opposite of what a
 * short TTL meant.
 */
export function kvTtlSeconds(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return MIN_KV_TTL_SECONDS;
  return Math.max(MIN_KV_TTL_SECONDS, Math.ceil(ms / 1000));
}

/** Read and JSON-parse a key. Returns null on miss or malformed content. */
export async function readJson(namespace, key) {
  if (!namespace) return null;
  try {
    const raw = await namespace.get(key, 'json');
    return raw ?? null;
  } catch {
    // A malformed entry is treated as a miss rather than failing the request; the
    // caller simply recomputes and overwrites it.
    return null;
  }
}

/** Write a JSON value with a millisecond-derived TTL. */
export async function writeJson(namespace, key, value, ms) {
  if (!namespace) return false;
  try {
    await namespace.put(key, JSON.stringify(value), { expirationTtl: kvTtlSeconds(ms) });
    return true;
  } catch {
    return false;
  }
}

/** Write a plain string with a millisecond-derived TTL. */
export async function writeText(namespace, key, value, ms) {
  if (!namespace) return false;
  try {
    await namespace.put(key, value, { expirationTtl: kvTtlSeconds(ms) });
    return true;
  } catch {
    return false;
  }
}

/** Delete a key, ignoring "not found". */
export async function remove(namespace, key) {
  if (!namespace) return false;
  try {
    await namespace.delete(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Append a key to a namespace index, so an invalidation can enumerate what to drop.
 *
 * KV cannot list by prefix, so `invalidateNamespace()` needs an index. The list is
 * capped because it is a convenience for invalidation, not a durable catalogue.
 */
export const INDEX_LIMIT = 500;

export async function indexAdd(namespace, indexKey, value) {
  if (!namespace) return;
  const current = (await readJson(namespace, indexKey)) ?? [];
  if (!Array.isArray(current) || current.includes(value)) return;
  const next = [...current, value];
  while (next.length > INDEX_LIMIT) next.shift();
  await writeJson(namespace, indexKey, next, 30 * 86400000);
}

export async function indexList(namespace, indexKey) {
  const current = (await readJson(namespace, indexKey)) ?? [];
  return Array.isArray(current) ? current : [];
}

export async function indexClear(namespace, indexKey) {
  await remove(namespace, indexKey);
}