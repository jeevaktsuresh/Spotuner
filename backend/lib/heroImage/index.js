import { TtlCache } from '../runtime/ttl-cache.js';
import * as kv from '../runtime/kv.js';

import localArtwork from './providers/localArtwork.js';
import musicMetadata from './providers/musicMetadata.js';
import artistImage from './providers/artistImage.js';
import externalSearch from './providers/externalSearch.js';
import fallback from './providers/fallback.js';

import { probeImage } from './probe.js';
import { rankCandidates, selectDistinct, confidenceTier, CONFIDENCE, fallbackGradient } from './score.js';

/**
 * Hero image matcher.
 *
 * Orchestrates the provider chain, probes candidate images for real
 * dimensions, scores and ranks the results, enforces a confidence floor, and
 * caches the outcome.
 *
 * Provider order encodes the priority from the spec:
 *
 *   local artwork -> music metadata -> artist image -> external search
 *
 * `fallback` always runs last and is never filtered out.
 */

/**
 * The active provider chain.
 *
 * Exported so a deployment can reorder or extend it without modifying the
 * matcher itself — the algorithm only knows how to run `name`/`find`.
 */
export const PROVIDERS = [
  localArtwork,
  musicMetadata,
  artistImage,
  externalSearch,
];

/** Successive cache tiers, so a stale entry can outlive a fresh search. */
const MEMORY_CACHE_MS = 60 * 60; // 1 hour
const PERSISTENT_CACHE_MS = 60 * 60 * 24 * 7; // 7 days

const memoryCache = new TtlCache({
  stdTTL: MEMORY_CACHE_MS,
  checkperiod: 600,
  maxKeys: 2000,
});

// The persistent tier is Cloudflare KV rather than a second in-process map: a
// Worker isolate has no permanent memory, so a 7-day cache that only lived in the
// process would in practice live for as long as one warm isolate did. Both TTLs
// are preserved — 1 hour hot, 7 days shared.

/** Stable identity for cache lookup. IDs beat text so renames still hit. */
function cacheKey(metadata) {
  return metadata.songId
    ? `song:${metadata.songId}`
    : metadata.albumId
      ? `album:${metadata.albumId}`
      : `${metadata.artist ?? ''}:${metadata.title ?? ''}:${metadata.album ?? ''}`
        .toLowerCase()
        .trim();
}

function kvKey(key) {
  return `hero:${key}`;
}

async function readCache(key) {
  const hot = memoryCache.get(key);
  if (hot) return hot;

  const stored = await kv.readJson(kv.cache(), kvKey(key));
  if (!stored) return null;

  memoryCache.set(key, stored, MEMORY_CACHE_MS);
  return stored;
}

/**
 * @param {string} key
 * @param {object} value
 */
function writeCache(key, value) {
  memoryCache.set(key, value, MEMORY_CACHE_MS);
  return kv.writeJson(kv.cache(), kvKey(key), value, PERSISTENT_CACHE_MS * 1000);
}

/** Only probe the most promising candidates; probing is one HTTP request each. */
const PROBE_LIMIT = 8;

/**
 * Probe candidate URLs concurrently, attaching real dimensions.
 *
 * Runs *after* a metadata-only pre-rank: probing costs an HTTP round trip, so
 * the budget must be spent on candidates that already look relevant, otherwise
 * it is exhausted on duplicates and dead renditions before the strongest
 * result is ever checked.
 */
async function probeCandidates(candidates) {
  const slice = candidates.slice(0, PROBE_LIMIT);
  const remaining = candidates.slice(PROBE_LIMIT);

  const probed = await Promise.all(
    slice.map(async (candidate) => {
      // Trust dimensions a provider already reported.
      if (candidate.probed?.ok) return candidate;

      const result = await probeImage(candidate.url);

      // Upgrade guesses often 404; keep the original as a backup.
      if (!result.ok && candidate.upgraded && candidate.upgraded !== candidate.url) {
        const retry = await probeImage(candidate.upgraded);
        if (retry.ok) return { ...candidate, url: candidate.upgraded, probed: retry };
      }

      return { ...candidate, probed: result };
    }),
  );

  return [...probed, ...remaining];
}

/**
 * Resolve the best hero image for a single piece of content.
 *
 * Never rejects: every failure path terminates in the fallback provider, so
 * the carousel always receives a renderable value.
 */
export async function matchHeroImage(metadata) {
  const key = cacheKey(metadata);
  const cached = await readCache(key);
  if (cached) return { ...cached, cached: true };

  const collected = [];

  // Providers run concurrently: a slow external search must not serialise
  // behind a fast local lookup.
  const results = await Promise.allSettled(
    PROVIDERS.filter((provider) => provider.enabled !== false).map((provider) =>
      provider.find(metadata),
    ),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      collected.push(...result.value);
    }
  }

  const fallbackCandidates = await fallback.find(metadata);

  // Nothing was discovered at all — go straight to the gradient.
  if (collected.length === 0) {
    const [terminal] = fallbackCandidates;
    const response = {
      ...terminal,
      title: metadata.title ?? '',
      artist: metadata.artist ?? '',
      imageUrl: null,
      confidence: 0,
      aspectRatio: null,
    };

    await writeCache(key, response);
    return response;
  }

  // Every response carries a gradient, whether or not an image matched. The
  // carousel renders this as its base layer, so a missing value would leave
  // the slide with no background at all behind the scrim.
  const gradient = fallbackGradient(metadata);

  // Two-phase ranking: a free metadata-only pass decides what is worth
  // probing, then only those candidates pay for a network round trip.
  const preRanked = rankCandidates(collected, metadata, { minScore: 0 });
  const probed = await probeCandidates(preRanked);
  const ranked = rankCandidates(probed, metadata, { minScore: CONFIDENCE.MEDIUM });

  // Everything scored below the floor: fall back rather than show a weak match.
  const [best] = ranked;

  const response = best
    ? {
        imageUrl: best.url,
        imageType: best.imageType,
        source: best.source,
        title: best.title || metadata.title,
        artist: best.artist || metadata.artist,
        album: best.album || metadata.album,
        confidence: best.score,
        tier: confidenceTier(best.score),
        aspectRatio: best.probed?.ok
          ? Number((best.probed.width / best.probed.height).toFixed(2))
          : 1,
        width: best.probed?.ok ? best.probed.width : null,
        height: best.probed?.ok ? best.probed.height : null,
        isArtworkOnly: best.isArtworkOnly,
        reasons: best.reasons,
        // Deterministic palette; the client refines it from real pixels when
        // the CDN permits a canvas read.
        background: gradient.background,
        dominantColors: gradient.dominantColors,
      }
    : (() => {
        const [terminal] = fallbackCandidates;
        return {
          ...terminal,
          imageUrl: null,
          title: metadata.title ?? '',
          artist: metadata.artist ?? '',
          confidence: 0,
          tier: 'low',
          aspectRatio: null,
          isArtworkOnly: false,
          reasons: ['below-confidence-floor'],
          background: gradient.background,
          dominantColors: gradient.dominantColors,
        };
      })();

  await writeCache(key, response);
  return response;
}

/**
 * Resolve several slides at once, enforcing visual diversity.
 *
 * Candidates are gathered for every slide first, then a single global
 * `selectDistinct` pass guarantees a near-tie on one slide cannot steal the
 * image already chosen for another.
 */
export async function matchHeroImages(metadataList) {
  const resolved = await Promise.all(metadataList.map((metadata) => matchHeroImage(metadata)));

  const rankedPool = resolved
    .filter((item) => item.imageUrl)
    .map((item) => ({ ...item, url: item.imageUrl, score: item.confidence, title: item.title }));

  const distinct = new Set(
    selectDistinct(rankedPool, rankedPool.length).map((candidate) => candidate.url),
  );

  return resolved.map((item) => ({
    ...item,
    // A duplicate URL across slides is demoted to the generated gradient so
    // the carousel never shows the same banner twice in a row.
    reusedAcrossSlides:
      Boolean(item.imageUrl) && !distinct.has(item.imageUrl) ? true : undefined,
  }));
}

/** Normalise a loosely-shaped track/artist object into matcher input. */
export function toMatcherInput(track = {}) {
  return {
    title: track.title ?? '',
    artist: track.artist ?? '',
    album: track.album ?? track.albumName ?? '',
    albumId: track.albumId,
    songId: track.id ?? track.songId,
    artistId: track.artistId,
    artworkUrl: track.image ?? track.artworkUrl ?? track.thumbnail,
  };
}