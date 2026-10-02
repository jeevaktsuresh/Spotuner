/**
 * Freshness metadata hydration.
 *
 * Sourced from the InnerTube `/player` endpoint via `youtube.getVideoMetadata`,
 * not from yt-dlp. Two reasons, both learned the hard way:
 *
 *   1. Reliability. YouTube answers yt-dlp with "Sign in to confirm you're not a
 *      bot" under sustained probing, which silently strips every date and view
 *      signal from a discovery run. The InnerTube path used by the rest of this
 *      project does not get blocked this way.
 *   2. Cost. ~150ms per video against ~2000ms for a full yt-dlp extraction. That
 *      is the difference between hydrating 45 candidates in about a second and
 *      needing a background job and a much lower ceiling.
 *
 * Caching still matters — dates never change, view counts drift — so records are
 * held in two tiers.
 */

import * as youtube from '../youtube.js';
import { envNum } from '../runtime/env.js';
import * as kv from '../runtime/kv.js';

/**
 * How long a record is trusted in full (dates, channel, description).
 *
 * Long, because these are immutable: a video's upload date does not move.
 */
const IMMUTABLE_TTL_MS = () => envNum('SPOTUNER_META_IMMUTABLE_TTL_MS', 7 * 86400000);

/**
 * How long view and like counts are trusted before being re-read.
 *
 * Shorter, because those genuinely move, and view velocity is computed from them.
 */
const VOLATILE_TTL_MS = () => envNum('SPOTUNER_META_VOLATILE_TTL_MS', 3 * 3600000);

/** Negative-cache TTL, so a persistently failing id is not retried every request. */
const FAILURE_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, {record: object|null, expiresAt: number}>} */
const immutableCache = new Map();
/** @type {Map<string, {record: object|null, expiresAt: number}>} */
const volatileCache = new Map();

const stats = { attempts: 0, fetched: 0, failed: 0, cacheHits: 0, kvHits: 0, lastError: null };

/**
 * Split a record into immutable and volatile halves.
 *
 * Views and likes are separated so a refresh can update them without re-reading
 * the immutable half.
 */
function split(record) {
  if (!record) return { immutable: null, volatile: null };

  const {
    viewCount, likeCount, isShortsEligible, isLive, duration, ...immutable
  } = record;

  return {
    immutable: {
      ...immutable,
      // Duration and Shorts eligibility are metadata, not counters, but they are
      // cheap to re-read with the rest of the volatile half.
      duration,
      isShortsEligible,
      isLive,
    },
    volatile: { viewCount, likeCount },
  };
}

/** Freshness probes, for the status route. */
export function probeStats() {
  return { ...stats };
}

/**
 * Hydrate tracks with dates, view counts, likes, channel and description.
 *
 * Cached records are merged without any network call; only uncached ids are
 * fetched. Returns new track objects; the input array is not mutated.
 *
 * @param {object[]} tracks
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh] Re-read view counts even if cached.
 * @returns {Promise<object[]>}
 */
/** Read one id from the shared tier, returning its two halves. */
async function readShared(id) {
  const [immutable, volatile] = await Promise.all([
    kv.readJson(kv.cache(), `meta:imm:${id}`),
    kv.readJson(kv.cache(), `meta:vol:${id}`),
  ]);

  return immutable === null && volatile === null ? null : { immutable, volatile };
}

/** Persist one id's two halves. */
async function writeShared(id, record, immutableTtl, volatileTtl) {
  const { immutable, volatile } = split(record);

  await Promise.all([
    kv.writeJson(kv.cache(), `meta:imm:${id}`, { record: immutable }, immutableTtl),
    kv.writeJson(kv.cache(), `meta:vol:${id}`, { record: volatile }, volatileTtl),
  ]);
}

/**
 * Hydrate tracks with dates, view counts, likes, channel and description.
 *
 * Three tiers, checked in that order: memory, then the shared KV tier, then the
 * network. Only ids absent from every tier pay for a `/player` request. Returns new
 * track objects; the input array is not mutated.
 *
 * @param {object[]} tracks
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh] Re-read view counts even if cached.
 * @returns {Promise<object[]>}
 */
export async function hydrate(tracks, { forceRefresh = false } = {}) {
  const list = tracks ?? [];
  if (list.length === 0) return [];

  const immutableTtl = IMMUTABLE_TTL_MS();
  const volatileTtl = VOLATILE_TTL_MS();
  const now = Date.now();

  /** Index-aligned output; every position is filled before the function returns. */
  const out = new Array(list.length);
  /** Ids with nothing in the memory tier, in first-seen order. */
  const unresolved = [];

  list.forEach((track, index) => {
    if (forceRefresh) volatileCache.delete(track.id);

    const volatileEntry = volatileCache.get(track.id);
    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now ? volatileEntry.record : null;

    if (volatileFresh) {
      stats.cacheHits += 1;
      out[index] = { ...track, ...volatileFresh, metadataCached: true };
      return;
    }

    const immutableEntry = immutableCache.get(track.id);
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now ? immutableEntry.record : null;

    if (immutableFresh) {
      stats.cacheHits += 1;
      out[index] = { ...track, ...immutableFresh, viewCount: null, likeCount: null, metadataCached: true };
      return;
    }

    if (!unresolved.includes(track.id)) unresolved.push(track.id);
    out[index] = { ...track, metadataCached: false };
  });

  // Shared tier. A Worker isolate starts cold constantly, so without this every
  // discovery run re-hydrates the same videos from InnerTube even though the
  // answer is cached globally.
  const unresolvedIds = new Set(unresolved);
  const needsFetch = [];

  if (kv.cache() && !forceRefresh) {
    const shared = await Promise.all(unresolved.map(async (id) => ({ id, record: await readShared(id) })));

    for (const { id, record } of shared) {
      unresolvedIds.delete(id);
      if (record) {
        stats.kvHits += 1;
        if (record.immutable) immutableCache.set(id, { record: record.immutable.record ?? null, expiresAt: now + immutableTtl });
        if (record.volatile) volatileCache.set(id, { record: record.volatile.record ?? null, expiresAt: now + volatileTtl });
        continue;
      }

      // A cached negative is an answer too: the id failed before, and the negative
      // entry is younger than the failure TTL.
      const negative = immutableCache.get(id);
      if (!negative) needsFetch.push(id);
    }
  } else {
    needsFetch.push(...unresolvedIds);
  }

  // Apply the shared-tier results in the caller's order.
  list.forEach((track, index) => {
    if (!unresolvedIds.has(track.id)) return;

    const volatileEntry = volatileCache.get(track.id);
    const immutableEntry = immutableCache.get(track.id);

    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now ? volatileEntry.record : null;
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now ? immutableEntry.record : null;

    if (!volatileFresh && !immutableFresh) return;

    stats.cacheHits += 1;
    out[index] = {
      ...out[index],
      ...(immutableFresh || {}),
      ...(volatileFresh || {}),
      metadataCached: true,
    };
  });

  if (needsFetch.length > 0) {
    stats.attempts += needsFetch.length;

    const fetched = await youtube.getVideoMetadata(needsFetch);
    const writes = [];

    for (const id of needsFetch) {
      const record = fetched[id] ?? null;

      if (record) {
        stats.fetched += 1;
        const { immutable, volatile } = split(record);
        immutableCache.set(id, { record: immutable, expiresAt: Date.now() + immutableTtl });
        volatileCache.set(id, { record: volatile, expiresAt: Date.now() + volatileTtl });
        writes.push(
          kv.writeJson(kv.cache(), `meta:imm:${id}`, { record: immutable }, immutableTtl),
          kv.writeJson(kv.cache(), `meta:vol:${id}`, { record: volatile }, volatileTtl),
        );
      } else {
        stats.failed += 1;
        immutableCache.set(id, { record: null, expiresAt: Date.now() + FAILURE_TTL_MS });
        volatileCache.set(id, { record: null, expiresAt: Date.now() + FAILURE_TTL_MS });
        writes.push(
          kv.writeJson(kv.cache(), `meta:imm:${id}`, { record: null }, FAILURE_TTL_MS),
          kv.writeJson(kv.cache(), `meta:vol:${id}`, { record: null }, FAILURE_TTL_MS),
        );
      }
    }

    await Promise.all(writes);
  }

  // Final pass: merge whatever is now cached for every id, in order.
  return list.map((track, index) => {
    const id = track.id;

    const volatileEntry = volatileCache.get(id);
    const immutableEntry = immutableCache.get(id);
    const now2 = Date.now();

    const volatileFresh = volatileEntry && volatileEntry.expiresAt > now2 ? volatileEntry.record : null;
    const immutableFresh = immutableEntry && immutableEntry.expiresAt > now2 ? immutableEntry.record : null;

    return { ...out[index], ...(immutableFresh || {}), ...(volatileFresh || {}) };
  });
}

/** Drop all cached metadata. Exposed for tests and manual refresh. */
export function clearCache() {
  immutableCache.clear();
  volatileCache.clear();
  stats.attempts = 0;
  stats.fetched = 0;
  stats.failed = 0;
  stats.cacheHits = 0;
  stats.kvHits = 0;
  stats.lastError = null;
}

/** Cache statistics, surfaced on the discovery status route. */
export function cacheStats() {
  const now = Date.now();
  return {
    immutableEntries: immutableCache.size,
    volatileEntries: volatileCache.size,
    volatileFresh: [...volatileCache.values()].filter((v) => v.expiresAt > now).length,
    immutableTtlMs: IMMUTABLE_TTL_MS(),
    volatileTtlMs: VOLATILE_TTL_MS(),
    backend: kv.cache() ? 'kv+memory' : 'memory',
    probes: { ...stats },
  };
}