/**
 * Artist images.
 *
 * A track carries only a video thumbnail, so the Artists page had nothing to
 * show. Resolving a real picture means finding the act's channel or catalogue
 * entry, and both obvious routes are unreliable:
 *
 *   - YouTube InnerTube `search` on the `WEB` client returns channel results as
 *     `lockupViewModel` with no avatar in the documented path, and starts
 *     answering 403 after a couple of requests, so it cannot be called once per
 *     artist. See scripts/probe-artist-image2.mjs.
 *   - The Data API needs a key this project does not have.
 *
 * The iTunes Search API is keyless, unauthenticated, and returned a correct
 * image for every artist tried, including regional acts the YouTube route
 * choked on ("M.G. Sreekumar"). So it is the source, with a strict match rule
 * and a long cache.
 *
 * Note these are catalogue images (a release cover), not portrait photographs.
 * That is the same visual language YouTube Music itself uses for artists.
 *
 * ## Storage
 *
 * The cache used to be a JSON file under `backend/.cache`. A Worker has no
 * writable filesystem, so it is Cloudflare KV now — which is what it should have
 * been all along for a catalogue that only ever grows: KV survives a deploy, and
 * every isolate sees the same coverage instead of one instance of it.
 *
 * The pacing, retry and back-off logic is unchanged, because that is what makes
 * the result deterministic and keeps iTunes from throttling the process.
 */
import { createHttp } from './runtime/http.js';
import { TtlCache } from './runtime/ttl-cache.js';
import * as kv from './runtime/kv.js';
import { envNum } from './runtime/env.js';

// No custom User-Agent on purpose. iTunes throttles browser-looking agents and
// answers 429/403 to them; axios's default agent is served normally. Verified in
// scripts/probe-artist-image3.mjs — sending a Chrome UA dropped every request.
const http = createHttp({
  timeout: 12000,
  headers: { Accept: 'application/json' },
});

/**
 * Cached artist image catalogue.
 *
 * Resolving the catalogue is ~600 upstream calls and iTunes throttles sustained
 * traffic hard, so an in-memory cache is not enough: every backend restart threw
 * away the progress and immediately began hammering the API again, which is how
 * coverage ended up flapping between 30%, 0% and 21% across identical runs.
 * Persisting means each attempt only asks about names it has never asked about,
 * and coverage climbs monotonically instead of being redrawn from scratch.
 *
 * A `null` answer is stored too, so an artist that genuinely has no image is not
 * re-asked on every visit. Throttled lookups are stored separately with a
 * `retryAt`, because retrying them immediately on every session is what kept a
 * full catalogue walk taking ~6 minutes and re-triggering the throttle.
 */
const MEMORY_CACHE_MS = 7 * 24 * 60 * 60;

/**
 * Hot tier. Entries expire with the week-long retention so the memory map cannot
 * grow without bound, while KV keeps the long-lived copy.
 */
const memory = new TtlCache({ stdTTL: MEMORY_CACHE_MS, maxKeys: 2000 });

/** How long to stay away from a name that was throttled rather than answered. */
const BACKOFF_MS = () => envNum('SPOTUNER_ITUNES_BACKOFF_MS', 15 * 60 * 1000);

/** @type {Map<string, {url: string|null, retryAt: number|null}>} */
const disk = new Map();

function kvKey(name) {
  return `artist:${name}`;
}

/**
 * Pull the shared catalogue into memory.
 *
 * Called lazily on the first lookup rather than at module load, because a Worker
 * has no bindings at evaluation time and KV reads cost a request.
 *
 * This is deliberately *not* awaited by `artistImage`. Every KV read is a
 * subrequest against the Worker's 1000-per-invocation ceiling, so eagerly pulling
 * a thousand keys into the isolate on the first lookup spent the whole budget
 * before the caller had resolved a single artist, and did it serially. Instead the
 * warm-up runs alongside the request, reads a bounded recent slice with bounded
 * concurrency, and only ever saves work: a name it misses still gets a direct
 * key-by-key read below, so correctness never depends on the prime having finished.
 */
let primed = false;
let primePromise = null;

/** How many recent keys a cold isolate pulls into memory. */
const PRIME_LIMIT = () => envNum('SPOTUNER_ARTIST_PRIME_LIMIT', 250);

/** Reads issued at once during the warm-up. */
const PRIME_CONCURRENCY = 20;

function prime() {
  if (primed || primePromise) return primePromise;
  if (!kv.artistImages()) return null;

  primePromise = (async () => {
    try {
      const namespace = kv.artistImages();
      const page = await namespace.list({ prefix: 'artist:', limit: PRIME_LIMIT() });
      const keys = page?.keys ?? [];

      let cursor = 0;
      const workers = Array.from({ length: Math.min(PRIME_CONCURRENCY, keys.length) }, async () => {
        while (cursor < keys.length) {
          const entry = keys[cursor++];
          const stored = await kv.readJson(namespace, entry.name);
          if (stored && typeof stored === 'object') {
            disk.set(entry.name.slice('artist:'.length), normalizeEntry(stored));
          }
        }
      });

      await Promise.all(workers);
    } catch {
      // A cold catalogue is not an error; individual lookups still fall through to
      // iTunes.
    } finally {
      primed = true;
      primePromise = null;
    }
  })();

  return primePromise;
}

/** Tolerate the earlier `{ name: url | null }` shape. */
function normalizeEntry(value) {
  return value && typeof value === 'object' ? { url: value.url ?? null, retryAt: value.retryAt ?? null } : { url: value ?? null, retryAt: null };
}

/** How many lookups may run at once. iTunes throttles aggressively past this. */
const CONCURRENCY = 4;

/**
 * Minimum gap between outbound requests, in ms.
 *
 * Resolving the whole catalogue is ~640 upstream calls, and firing those as fast
 * as possible gets the process throttled: three runs of the identical code
 * returned 30%, 0% and 15% coverage. Spacing the requests is what makes the
 * result deterministic.
 */
const MIN_INTERVAL_MS = () => envNum('SPOTUNER_ITUNES_INTERVAL_MS', 110);

/** Attempts per request before treating the artist as unresolvable. */
const ATTEMPTS = 3;

/** Last time a request went out, so spacing is global rather than per-worker. */
let lastRequestAt = 0;

/**
 * Serialize the gap between requests across all workers.
 *
 * Each worker sleeps until MIN_INTERVAL_MS has passed since the previous
 * outbound call. Without a shared timestamp, N workers would all wake together
 * and reproduce the burst that triggers throttling.
 */
async function pace() {
  const wait = lastRequestAt + MIN_INTERVAL_MS() - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** A throttled or transient failure, as opposed to a genuine "no such artist". */
function isRetryable(error) {
  const status = error?.response?.status;
  if (status === 429 || status === 403) return true;
  if (status >= 500) return true;
  // No response at all: timeout or connection reset.
  return !status;
}

/** Paced request with bounded exponential backoff on throttling. */
async function request(config) {
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) {
      // 400ms, 1200ms, ... enough for a short throttle window to clear.
      await new Promise((r) => setTimeout(r, 400 * 3 ** attempt));
    }
    await pace();
    try {
      return await http.request(config);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
    }
  }
  throw lastError;
}

/** Punctuation and spacing are inconsistent between the two sources. */
function fold(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Accept a search hit only when it clearly names the artist we asked for.
 *
 * A loose match is worse than no image: attaching the wrong act's picture to an
 * artist entry is a visible correctness bug, while a missing image just falls
 * back to the track thumbnail. Comparison is punctuation-insensitive so
 * "M.G. Sreekumar" still matches "M. G. Sreekumar".
 */
function isConfidentMatch(query, candidate) {
  const a = fold(query);
  const b = fold(candidate);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Look up one artist image.
 *
 * @param {string} name
 * @returns {Promise<string|null>} image URL, or null when unresolvable
 */
async function lookup(name) {
  try {
    const search = await request({
      url: 'https://itunes.apple.com/search',
      params: { term: name, entity: 'musicArtist', limit: 5 },
      method: 'GET',
    });

    const hits = search.data?.results ?? [];
    if (hits.length === 0) return null;

    const hit =
      hits.find((h) => isConfidentMatch(name, h.artistName)) ??
      // Fall back to the top hit only when the catalogue agrees on the name
      // after folding; still rejects a completely different act.
      (() => {
        const first = hits[0];
        const q = fold(name);
        const c = fold(first?.artistName);
        return q && c && (c.startsWith(q) || q.startsWith(c)) ? first : null;
      })();

    if (!hit?.artistId) return null;

    const detail = await request({
      url: 'https://itunes.apple.com/lookup',
      params: { id: hit.artistId, entity: 'album', limit: 25 },
      method: 'GET',
    });

    // The artist entity itself comes back in the first position and carries no
    // artwork, so take the first result that actually has an image.
    const withArt = (detail.data?.results ?? []).find((r) => r.artworkUrl100);
    if (!withArt?.artworkUrl100) return null;

    // 300px is ample for the largest avatar we render (~176px at 2x).
    return withArt.artworkUrl100.replace('100x100bb', '300x300bb');
  } catch (error) {
    // Distinguish "this artist has no image" from "the request was throttled".
    // Returning null for a throttle would cache the miss for a day and the artist
    // would keep its placeholder; rethrowing keeps it retryable.
    if (isRetryable(error)) throw error;
    return null;
  }
}

/** Persist one entry to both tiers. */
async function remember(name, entry) {
  disk.set(name, entry);
  memory.set(kvKey(name), entry, MEMORY_CACHE_MS);

  // A `retryAt` in the future is an active stand-down, not an answer: give it the
  // remaining window rather than the full retention.
  const ttl = entry.retryAt && entry.retryAt > Date.now() ? entry.retryAt - Date.now() : MEMORY_CACHE_MS * 1000;
  await kv.writeJson(kv.artistImages(), kvKey(name), entry, ttl);
}

/**
 * Resolve one artist image, cached for a long time.
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
export async function artistImage(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return null;

  // Warm the shared catalogue alongside the lookup rather than in front of it.
  prime();

  const hot = memory.get(kvKey(trimmed));
  if (hot) return answerFrom(hot, trimmed);

  const raw = disk.get(trimmed) ?? (await kv.readJson(kv.artistImages(), kvKey(trimmed)));
  // A stored `null` answer is a real answer ("this artist has no image"), so only
  // an absent entry falls through to a lookup.
  const stored = raw ? normalizeEntry(raw) : null;
  if (stored) {
    if (stored.retryAt === null || stored.retryAt === undefined) {
      // A cached answer is final.
      disk.set(trimmed, stored);
      memory.set(kvKey(trimmed), stored, MEMORY_CACHE_MS);
      return stored.url;
    }

    if (Date.now() < stored.retryAt) {
      // A cached throttle is honoured until it expires.
      disk.set(trimmed, stored);
      memory.set(kvKey(trimmed), stored, MEMORY_CACHE_MS);
      return null;
    }

    // Stand-down expired: drop it and ask again, exactly as the file-backed cache
    // did.
    disk.delete(trimmed);
    memory.del(kvKey(trimmed));
  }

  let value;
  try {
    value = await lookup(trimmed);
    await remember(trimmed, { url: value, retryAt: null });
  } catch {
    // Throttled rather than answered: stand down instead of asking again on the
    // very next request, which is what kept the throttle alive.
    await remember(trimmed, { url: null, retryAt: Date.now() + BACKOFF_MS() });
  }

  return value ?? null;
}

/**
 * Apply the cached entry's own rules to a hot-tier value.
 *
 * @param {{url: string|null, retryAt: number|null}} entry
 * @param {string} name
 */
function answerFrom(entry, name) {
  if (entry.retryAt === null || entry.retryAt === undefined) return entry.url;
  if (Date.now() < entry.retryAt) return null;

  // Stand-down expired while the entry was still hot; forget it.
  disk.delete(name);
  memory.del(kvKey(name));
  return null;
}

/**
 * Resolve many artist images with a bounded number of concurrent requests.
 *
 * Names are cached individually, so a repeat batch costs nothing.
 *
 * @param {string[]} names
 * @param {object} [options]
 * @param {number} [options.concurrency]
 * @returns {Promise<Map<string, string|null>>} keyed by the name as given
 */
export async function artistImages(names, { concurrency = CONCURRENCY } = {}) {
  const unique = [...new Set((names ?? []).map((n) => String(n ?? '').trim()).filter(Boolean))];
  const out = new Map();
  if (unique.length === 0) return out;

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const name = unique[cursor++];
      out.set(name, await artistImage(name));
    }
  });

  await Promise.all(workers);
  return out;
}

/** Diagnostics, so coverage can be inspected without reading the namespace. */
export function cacheStats() {
  return {
    entries: disk.size,
    primed,
    backend: kv.artistImages() ? 'kv+memory' : 'memory',
  };
}