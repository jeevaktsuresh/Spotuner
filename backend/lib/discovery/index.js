/**
 * Music discovery — public entry point.
 *
 * The pipeline, in order:
 *
 *   several date-rotated YouTube searches
 *     -> pool + de-duplicate, tracking cross-query presence
 *     -> cheap quality filter (no network)
 *     -> pre-rank on search-only evidence, take the top slice
 *     -> hydrate that slice with yt-dlp (dates, views, likes)
 *     -> language detection
 *     -> release-age assessment
 *     -> trending / latest scoring
 *     -> diversity + repetition damping
 *     -> top N
 *
 * Two hydration facts worth stating, because they constrain the whole design:
 *
 *   1. InnerTube search returns no publish date at all — only a rounded play
 *      count. Nothing about "new" or "trending" can be computed without yt-dlp.
 *   2. yt-dlp costs roughly two seconds per video, so it is applied to a bounded
 *      pre-ranked slice rather than the entire raw pool.
 */

import { envNum } from '../runtime/env.js';
import * as youtube from '../youtube.js';
import * as language from '../language/index.js';
import * as metadataLayer from '../metadata/index.js';
import { leadArtistName } from '../metadata/identity.js';
import { trendingQueries, latestQueries, forYouQueries, regionFor } from './queries.js';
import { poolCandidates } from './pool.js';
import { assessQuality, releaseEvidence } from './quality.js';
import * as metadata from './metadata.js';
import { freshnessSignals, DECAY } from './freshness.js';
import { trendingScore, latestScore, musicConfidence } from './score.js';
import { applyArtistDiversity, repetitionMultiplier, markShown, repetitionStats } from './diversity.js';
import { applyShelfDiversity, languageSpread } from './dimensions.js';
import { buildProfile, forYouScore, FORYOU_WEIGHTS, PENALTY_WEIGHTS } from './foryou.js';
import * as swrcache from './swrcache.js';
import { TRENDING_WEIGHTS, LATEST_WEIGHTS } from './score.js';

export { TRENDING_WEIGHTS, LATEST_WEIGHTS, DECAY } from './score.js';
export { TTL } from './swrcache.js';

/**
 * Invalidate every cached entry for a discovery namespace.
 *
 * Exposed as a function rather than by re-exporting the cache module, so callers
 * depend on this API rather than on the cache's shape. `server.js` reached for
 * `discovery.swrcache.invalidateNamespace(...)`, which was never exported, so
 * every `POST /api/discovery/refresh` failed with
 * "Cannot read properties of undefined" and silently left stale data in place.
 *
 * Async because the shared (KV) tier has to be walked as well as the local one;
 * the route awaits it, which is also what the original code intended to do.
 */
export function invalidateNamespace(namespace) {
  return swrcache.invalidateNamespace(namespace);
}
export { FORYOU_WEIGHTS, PENALTY_WEIGHTS, buildProfile, forYouScore } from './foryou.js';

/** How many raw results to request per query. */
const PER_QUERY = 30;

/**
 * How many pooled candidates get the per-video metadata fetch.
 *
 * Was bounded tightly when metadata came from yt-dlp at ~2s per video. It is now
 * an InnerTube call at ~150ms with concurrency 8, so the same 45 candidates cost
 * under a second and the ceiling can be raised for much better pool coverage.
 */
const HYDRATE_LIMIT = () => envNum('SPOTUNER_HYDRATE_LIMIT', 90);

/** Minimum pool size worth ranking. Below this the shelf stays empty. */
const MIN_POOL = 8;

/**
 * Score floor, below which a track is not shown at all.
 *
 * The freshness gate drives old tracks toward zero rather than excluding them,
 * which is right for ordering but wrong for filling: a shelf that pads itself up
 * to `limit` with gated-to-nothing old tracks looks populated while showing the
 * stale catalogue this module exists to replace. That was measurable — the
 * Malayalam trending shelf was padding with tracks 1,666 days old because the
 * regional pool is thin.
 *
 * So an under-populated shelf is returned short, and `stats.belowFloor` reports
 * how many tracks were withheld. This matches how the language shelves already
 * behave: return nothing rather than return something wrong.
 */
const MIN_SCORE = {
  get trending() {
    return envNum('SPOTUNER_MIN_TRENDING_SCORE', 12);
  },
  get latest() {
    return envNum('SPOTUNER_MIN_LATEST_SCORE', 18);
  },
};

/** Damping multiplier applied per signal, configurable so it can be tuned live. */
const REPETITION_WEIGHT = () => envNum('SPOTUNER_REPETITION_WEIGHT', 1);

/** Trackers that are catalog-adjacent and not really artists. */
const NON_ARTIST_TITLES = new Set([
  'various artists', 'various', 'unknown', 'topic', 'various artists topic',
]);

/**
 * Lead artist for identity and diversity purposes.
 *
 * Delegates to the shared splitter so artist identity means one thing across the
 * metadata layer, the diversity cap and this module.
 */
function leadArtist(track) {
  const first = leadArtistName(track.artist) ?? '';
  return NON_ARTIST_TITLES.has(first.toLowerCase()) ? '' : first;
}

/**
 * Run the discovery queries for one request.
 *
 * Failures are tolerated per query: if five of eight queries fail, the run still
 * returns results from the three that succeeded rather than failing the request.
 */
async function gatherCandidates({ kind, languageCode, global, now, profile }) {
  const queries =
    kind === 'trending'
      ? trendingQueries({ language: languageCode, now })
      : kind === 'foryou'
        ? forYouQueries({ language: languageCode, profile, now })
        : latestQueries({ language: languageCode, now });

  const region = regionFor(languageCode, { global });

  const settled = await Promise.allSettled(
    queries.map((query) => youtube.search(query, PER_QUERY, { region }))
  );

  const resultSets = settled
    .map((result, index) =>
      result.status === 'fulfilled'
        ? { query: queries[index], tracks: result.value }
        : null
    )
    .filter(Boolean);

  return { candidates: poolCandidates(resultSets), queriesRun: resultSets.length, queriesFailed: settled.length - resultSets.length };
}

/**
 * Cheap pre-ranking used to choose what gets hydrated.
 *
 * Runs before any yt-dlp call, on search-only evidence: cross-query presence,
 * YouTube's own rank, and the play count from search. The point is not accuracy
 * but spend — it selects the most plausible candidates for the expensive stage.
 */
function preRank(candidate) {
  const cross = Math.min(1, candidate.queryCount / 4);
  const rank = Number.isFinite(candidate.bestRank) ? 1 - (candidate.bestRank - 1) / 29 : 0;
  const plays = Number.isFinite(candidate.playCount)
    ? Math.min(1, (Math.log10(candidate.playCount + 1) + 1) / 8)
    : 0.35; // unknown plays: neutral, not zero

  return cross * 0.45 + Math.max(0, rank) * 0.3 + plays * 0.25;
}

/**
 * Build the normalized, scored track objects returned to the frontend.
 *
 * The shape matches the documented contract: identity fields, language, dates,
 * the freshness signals, both scores, and the evidence behind them, so the
 * ranking is inspectable rather than opaque.
 */
function project(track, { kind }) {
  const evidence = releaseEvidence(track);
  const signals = freshnessSignals(track, evidence);

  const trust = musicConfidence(track, evidence);
  const context = {
    queryCount: track.queryCount,
    bestRank: track.bestRank,
    musicTrust: trust,
  };

  const trending = trendingScore(signals, context);
  const latest = latestScore(signals, context);

  return {
    // --- identity ---
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    image: track.image,
    duration: track.duration,
    url: track.url,
    source: track.source || 'youtube',

    // --- canonical metadata (from the provider layer) ---
    // `artists` is the split credit line, so a collaboration credits every
    // performer rather than only the display string.
    artists: track.artists ?? [track.artist],
    albumId: track.albumId ?? null,
    thumbnail: track.image,
    isrc: track.isrc ?? null,
    musicBrainzId: track.musicBrainzId ?? null,
    youtubeId: track.youtubeId ?? track.id,
    // Populated when Spotify matched this recording. It carries no playback of its
    // own — see `playbackProvider` — but it is what lets a later request resolve a
    // Spotify-sourced version or report the counterpart.
    spotifyId: track.spotifyId ?? null,
    genres: track.genres ?? [],
    metadataSources: track.metadataSources ?? ['youtube'],

    // --- playback ---
    // Discovery only ever produces YouTube candidates, so these are known here
    // rather than resolved per track. They are stated explicitly because the
    // canonical shape carries them and a client should not have to infer them from
    // `source`.
    playable: true,
    playbackProvider: 'youtube',
    metadataQuality: track.metadataQuality ?? null,

    // --- language ---
    language: track.language || 'unknown',
    languageName: track.languageName || 'Unknown',
    languageConfidence: track.languageConfidence ?? 0,

    // --- freshness metadata ---
    publishedAt: track.uploadDate ? new Date(track.uploadDate).toISOString() : null,
    releaseDate: track.releaseDate ? new Date(track.releaseDate).toISOString() : null,
    views: signals.views,
    likes: Number.isFinite(track.likeCount) ? track.likeCount : null,
    channel: track.channel ?? null,
    ageInDays: signals.ageInDays,
    releaseAgeInDays: signals.releaseAgeInDays,
    isShort: Number.isFinite(track.duration) && track.duration > 0 && track.duration < 60,
    isMusic: true,
    isNewRelease: signals.isNewRelease,
    newReleaseConfidence: Math.round(signals.confidence * 1000) / 1000,
    newReleaseReasons: signals.reasons,

    // --- scores ---
    trendingScore: trending.score,
    latestScore: latest.score,
    scoreBreakdown: kind === 'trending' ? trending.parts : latest.parts,
    freshness: {
      recency: signals.recency,
      releaseRecency: signals.releaseRecency,
      velocity: signals.velocity,
      velocityForTrending: signals.velocityForTrending,
      freshnessGate: signals.freshnessGate,
      releaseGate: signals.releaseGate,
      engagement: signals.engagement,
    },

    // --- provenance ---
    discoverySources: track.discoverySources,
    queryCount: track.queryCount,
    bestRank: track.bestRank,
    duplicateUploads: track.duplicateUploads ?? 0,
    metadataCached: Boolean(track.metadataCached),
  };
}

/**
 * Core discovery run. Shared by every public entry point.
 *
 * @param {object} options
 * @param {'trending'|'latest'|'foryou'} options.kind
 * @param {string|null} [options.languageCode]
 * @param {boolean} [options.global]  Skip the India region bias.
 * @param {number} [options.limit]
 * @param {number} [options.maxPerArtist]
 * @param {string[]} [options.excludeIds]  Already-shown tracks, for diversity
 * @param {boolean} [options.markShownOnServe]
 * @param {Date} [options.now]
 * @param {boolean} [options.enrichMetadata]  Consult enrichment providers.
 * @param {object} [options.userProfile]  Compact listening summary, for 'foryou'.
 */
async function discover({
  kind,
  languageCode = null,
  global = false,
  limit = 20,
  maxPerArtist = 2,
  excludeIds = [],
  markShownOnServe = false,
  now = new Date(),
  forceRefresh = false,
  enrichMetadata = true,
  userProfile = null,
}) {
  const { candidates, queriesRun, queriesFailed } = await gatherCandidates({
    kind,
    languageCode,
    global,
    now,
    profile: userProfile,
  });

  // --- cheap quality filter on search-only evidence ---
  // Only removes what search alone can prove is wrong: Shorts, live streams and
  // records with no usable duration. Deeper checks need the channel name and
  // category, which do not exist until metadata is fetched.
  const searchViable = [];
  for (const candidate of candidates) {
    const verdict = assessQuality(candidate);
    if (verdict.ok) searchViable.push(candidate);
  }

  if (searchViable.length < MIN_POOL) {
    return {
      kind,
      scope: global ? 'global' : languageCode || 'in',
      tracks: [],
      generatedAt: new Date(now).toISOString(),
      stats: {
        queriesRun,
        queriesFailed,
        candidates: candidates.length,
        afterQualityFilter: searchViable.length,
        hydrated: 0,
        insufficientPool: true,
      },
    };
  }

  // --- pre-rank, then fetch metadata for the plausible slice ---
  const toHydrate = [...searchViable]
    .sort((a, b) => preRank(b) - preRank(a))
    .slice(0, HYDRATE_LIMIT());

  const hydrated = await metadata.hydrate(toHydrate, { forceRefresh });

  // --- metadata enrichment + cross-provider de-duplication ---
  //
  // Runs after hydration because hydration is what supplies the release date and
  // category that make a provider match verifiable, and before quality filtering
  // because a merged record may be the one that carries the channel and duration
  // the filter reads.
  //
  // Enrichment is optional by construction: `prepare()` resolves to the
  // YouTube-only tracks if any provider is unavailable, so an outage here changes
  // nothing about what is returned. Spotify is consulted alongside MusicBrainz and
  // contributes the release dates and ISRCs YouTube does not have; it never
  // introduces a candidate and never decides the ranking.
  const { tracks: enriched, report: metadataReport } = await metadataLayer.prepare(hydrated, {
    enrich: enrichMetadata,
  });

  // --- full quality filter, now with channel and category ---
  // Run second, on purpose. Channel name, category and the Shorts flag only exist
  // after hydration, and the title blocklist needs them as corroboration —
  // filtering on titles alone deletes real songs, which the requirement explicitly
  // warns against.
  const qualityFiltered = [];
  const rejected = [];

  for (const candidate of enriched) {
    const verdict = assessQuality(candidate);
    if (verdict.ok) qualityFiltered.push(candidate);
    else rejected.push({ id: candidate.id, title: candidate.title, reason: verdict.reason });
  }

  // --- language detection ---
  // Every track still passes through the classifier: a query is a hint, never a
  // filter. `searchContexts` lets a track seen by a Malayalam query earn
  // Malayalam, but only alongside hard evidence.
  const annotated = await language.annotate(qualityFiltered, {
    searchContexts: languageCode ? [languageCode] : [],
  });

  // --- language gate ---
  const languageMatched = languageCode
    ? annotated.filter((t) => t.language === languageCode)
    : annotated;

  // --- score ---
  const projected = languageMatched.map((track) => project(track, { kind }));

  // --- For You: replace the editorial score with the personalised one ---
  // Trending and latest are objective questions, so they use the freshness scores.
  // "For You" is a question about *this* listener, so it ranks on affinity
  // instead, while still folding in freshness and popularity so the shelf stays
  // current rather than replaying the user's own history back at them.
  let ranked = projected;

  if (kind === 'foryou') {
    const profile = buildProfile(userProfile ?? {});

    ranked = projected
      .map((track) => {
        const { score, parts, reason } = forYouScore(track, profile, {
          queryCount: track.queryCount,
          bestRank: track.bestRank,
          signals: track.freshness,
        });

        return {
          ...track,
          forYouScore: score,
          forYouBreakdown: parts,
          forYouReason: reason,
          // For You sorts on its own score, so the sort key below is redirected.
          scoreBreakdown: parts,
        };
      })
      .sort((a, b) => b.forYouScore - a.forYouScore);
  } else {
    // Repetition damping. Applied to whichever score this shelf sorts on, so a
    // demoted track is demoted where it actually matters. For You handles
    // repetition through its own played/skip penalties instead.
    const scoreKey = kind === 'trending' ? 'trendingScore' : 'latestScore';

    ranked = projected
      .map((track) => {
        const multiplier = repetitionMultiplier(track.id, now.getTime());
        return {
          ...track,
          repetitionMultiplier: Math.round(multiplier * 1000) / 1000,
          effectiveScore:
            Math.round(track[scoreKey] * (1 - REPETITION_WEIGHT() + REPETITION_WEIGHT() * multiplier) * 10) / 10,
        };
      })
      .sort((a, b) => b.effectiveScore - a.effectiveScore);
  }

  const sortKey = kind === 'foryou' ? 'forYouScore' : 'effectiveScore';
  if (kind === 'foryou') {
    ranked = ranked.map((t) => ({ ...t, effectiveScore: t.forYouScore }));
  }

  // --- diversity ---
  // Artist cap (existing), then album and language (new). Both defer rather than
  // delete, so a thin shelf still fills.
  const artistCapped = applyArtistDiversity(ranked, {
    maxPerArtist,
    excludeIds: excludeIds.map((id) => String(id).toLowerCase()),
  });

  const diversified = applyShelfDiversity(artistCapped, { limit });

  // --- score floor ---
  // Applied after diversity, so the floor is absolute rather than something the
  // diversity pass can route around by deferring a track to the end.
  // For You has no floor: the score is personal, so a lower absolute value is not
  // the same signal of poor quality it is for trending.
  const floor = MIN_SCORE[kind] ?? 0;
  const eligible = kind === 'foryou' ? diversified : diversified.filter((t) => t.effectiveScore >= floor);
  const tracks = eligible.slice(0, limit);

  if (markShownOnServe) markShown(tracks.map((t) => t.id));

  return {
    kind,
    scope: global ? 'global' : languageCode || 'in',
    generatedAt: new Date(now).toISOString(),
    tracks,
    stats: {
      queriesRun,
      queriesFailed,
      candidates: candidates.length,
      afterQualityFilter: qualityFiltered.length,
      hydrated: hydrated.length,
      enriched: metadataReport.enrichment.enriched,
      enrichmentCoverage: metadataReport.enrichment.coverage,
      enrichmentErrors: metadataReport.enrichment.errors,
      duplicatesMerged: metadataReport.dedupe.merged,
      languageMatched: languageMatched.length,
      rejectedSample: rejected.slice(0, 10),
      insufficientPool: false,
      minScore: floor,
      belowFloor: diversified.length - eligible.length,
      newReleases: tracks.filter((t) => t.isNewRelease).length,
      medianAgeDays: median(tracks.map((t) => t.ageInDays).filter(Number.isFinite)),
      languageSpread: languageSpread(tracks),
      personalisation: kind === 'foryou' ? describeProfile(userProfile) : null,
    },
  };
}

function describeProfile(input) {
  const profile = buildProfile(input ?? {});
  return {
    tier: profile.tier,
    confidence: Math.round(profile.confidence * 1000) / 1000,
    hasHistory: profile.hasHistory,
    artists: profile.artists.map.size,
    languages: profile.languages.map.size,
    genres: profile.genres.map.size,
    skippedArtists: profile.skipped.map.size,
  };
}

/**
 * Trending music.
 *
 * @param {object} [options]
 * @param {string|null} [options.language]  ISO code, e.g. 'ml'
 * @param {boolean} [options.global]  Skip India region bias
 * @param {number} [options.limit]
 * @param {boolean} [options.refresh]  Bypass the cached entry
 */
export async function getTrendingMusic(options = {}) {
  const {
    language = null,
    global = globalByDefault(language),
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh = false,
    now = new Date(),
  } = options;

  const params = { kind: 'trending', language: language ?? 'global', global: Boolean(global), limit, maxPerArtist };

  if (refresh) swrcache.invalidate('trending', params);

  const { value, age, stale, refreshing } = await swrcache.cached(
    'trending',
    params,
    () => discover({ kind: 'trending', languageCode: language, global, limit, maxPerArtist, now, forceRefresh: true }),
    { ttlMs: swrcache.TTL.trending }
  );

  // Repositories are applied per request, not baked into the cache entry, so the
  // same cached pool can serve several callers with different histories.
  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({
      ...t,
      repetitionMultiplier: Math.round(repetitionMultiplier(t.id, Date.now()) * 1000) / 1000,
    })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);

  markShown(withDiversity.map((t) => t.id));

  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: swrcache.TTL.trending },
  };
}

/** Latest releases. Same pipeline, different query family and score. */
export async function getLatestMusic(options = {}) {
  const {
    language = null,
    global = globalByDefault(language),
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh = false,
    now = new Date(),
  } = options;

  const params = { kind: 'latest', language: language ?? 'global', global: Boolean(global), limit, maxPerArtist };

  if (refresh) swrcache.invalidate('latest', params);

  const { value, age, stale, refreshing } = await swrcache.cached(
    'latest',
    params,
    () => discover({ kind: 'latest', languageCode: language, global, limit, maxPerArtist, now, forceRefresh: true }),
    { ttlMs: swrcache.TTL.latest }
  );

  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({
      ...t,
      repetitionMultiplier: Math.round(repetitionMultiplier(t.id, Date.now()) * 1000) / 1000,
    })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);

  markShown(withDiversity.map((t) => t.id));

  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: swrcache.TTL.latest },
  };
}

/**
 * Cached wrapper for the full shelf payload.
 *
 * `/api/shelves` runs three discovery passes plus the editorial shelf build, all
 * of which fan out into live YouTube queries — measured at 8-28 seconds, and
 * different on every call. Caching it here means a page navigation is served
 * from memory and YouTube is not re-queried for data that has not changed.
 *
 * Uses the same stale-while-revalidate cache as every other discovery entry
 * point, with the catalogue TTL, because editorial shelves are the slowest-moving
 * of the three families. The discovery rows nested inside still carry their own
 * shorter per-scope entries, so those refresh as often as trending does.
 */
export async function shelves(params, producer) {
  return swrcache.cached('shelves', params, producer, {
    ttlMs: swrcache.TTL.catalog,
    staleGraceMs: swrcache.staleGraceMs(),
  });
}

/** Trending within one language. */
export function getTrendingByLanguage(code, options = {}) {
  return getTrendingMusic({ ...options, language: code, global: false });
}

/**
 * Personalised "For You" music.
 *
 * Unlike trending and latest, the result depends on the listener, so it is not
 * cached by scope alone — the cache key includes a fingerprint of the profile.
 * That keeps two listeners on the same browser from receiving each other's
 * shelf, while still letting an unchanged profile hit the cache.
 *
 * @param {object} [options]
 * @param {string|null} [options.language]
 * @param {object} [options.profile]  Compact listening summary from the client.
 * @param {number} [options.limit]
 * @param {boolean} [options.global]  Skip the India region bias.
 * @param {number} [options.maxPerArtist]
 * @param {string[]} [options.excludeIds]  Already-shown tracks, for diversity.
 * @param {boolean} [options.refresh]  Bypass the cached entry.
 * @param {boolean} [options.enrichMetadata]  Hydrate artwork/artists before serving.
 */
export async function getForYouMusic(options = {}) {
  const {
    language = null,
    global = false,
    limit = 20,
    maxPerArtist = 2,
    excludeIds = [],
    refresh = false,
    profile = null,
    enrichMetadata = true,
    now = new Date(),
  } = options;

  const params = {
    kind: 'foryou',
    language: language ?? 'global',
    global: Boolean(global),
    limit,
    maxPerArtist,
    // A short digest, not the profile itself: enough to separate two listeners,
    // not enough to reconstruct a listening history from a cache key.
    profile: fingerprint(profile),
  };

  if (refresh) swrcache.invalidate('foryou', params);

  const { value, age, stale, refreshing } = await swrcache.cached(
    'foryou',
    params,
    () =>
      discover({
        kind: 'foryou',
        languageCode: language,
        global,
        limit,
        maxPerArtist,
        now,
        forceRefresh: true,
        enrichMetadata,
        userProfile: profile,
      }),
    // Shorter than trending: personalisation is the thing most likely to have
    // changed, and the candidate pool is cheap to rebuild when warm.
    { ttlMs: Math.min(swrcache.TTL.trending, 10 * 60 * 1000) }
  );

  const withDiversity = applyArtistDiversity(
    value.tracks.map((t) => ({ ...t })),
    { maxPerArtist, excludeIds }
  ).slice(0, limit);

  markShown(withDiversity.map((t) => t.id));

  return {
    ...value,
    tracks: withDiversity,
    cache: { age, stale, refreshing, ttlMs: Math.min(swrcache.TTL.trending, 10 * 60 * 1000) },
  };
}

/**
 * Stable short digest of a listening profile, for cache keying.
 *
 * Order-independent and non-reversible. Two identical profiles produce the same
 * digest regardless of key order, and the digest reveals nothing about what the
 * user listens to beyond "has this profile changed".
 */
export function fingerprint(profile) {
  if (!profile || typeof profile !== 'object') return 'anonymous';

  const parts = ['artists', 'languages', 'genres', 'skippedArtists']
    .map((dimension) => {
      const entries = Object.entries(profile[dimension] ?? {})
        .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0)
        .map(([k, v]) => `${k}:${Number(v).toFixed(3)}`)
        .sort();
      return `${dimension}=${entries.join(',')}`;
    })
    .join('|');

  const plays = Number(profile.totalPlays) || 0;

  // Short and non-cryptographic: this distinguishes cache entries, it does not
  // protect anything. A hash would imply a guarantee this does not provide.
  let hash = 0;
  const input = `${parts}|plays=${plays}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }

  return `${plays}-${(hash >>> 0).toString(36)}`;
}

/** Latest within one language. */
export function getLatestByLanguage(code, options = {}) {
  return getLatestMusic({ ...options, language: code, global: false });
}

/** A language-scoped request defaults to the India region; global does not. */
function globalByDefault(language) {
  return !language;
}

function median(values) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (list.length === 0) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid];
}

/** Everything the status/diagnostics route needs. */
export function status() {
  return {
    cache: swrcache.stats(),
    metadata: metadata.cacheStats(),
    repetition: repetitionStats(),
    weights: { trending: TRENDING_WEIGHTS, latest: LATEST_WEIGHTS, foryou: FORYOU_WEIGHTS },
    penalties: PENALTY_WEIGHTS,
    decay: DECAY,
    providers: metadataLayer.registry.providerNames(),
    providerStats: metadataLayer.registry.providerStats(),
    config: {
      perQuery: PER_QUERY,
      hydrateLimit: HYDRATE_LIMIT(),
      minPool: MIN_POOL,
      repetitionWeight: REPETITION_WEIGHT(),
    },
  };
}