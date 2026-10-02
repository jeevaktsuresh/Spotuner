import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as youtube from './lib/youtube.js';
import * as language from './lib/language/index.js';
import * as discovery from './lib/discovery/index.js';
import * as manager from './lib/metadata/manager.js';
import * as spotify from './lib/metadata/providers/spotify.js';
import * as streamCache from './lib/runtime/stream-cache.js';
import { artistImages } from './lib/artists.js';
import { matchHeroImage, matchHeroImages, toMatcherInput } from './lib/heroImage/index.js';

dotenv.config();

/**
 * Fallback Express server.
 *
 * The Worker in `src/` is the deployed backend. This entry point is retained for
 * local Node work and for the CLI probes in `scripts/`, and it is the reason the
 * shared `lib/` modules read configuration lazily: they have to work under both
 * runtimes, where configuration arrives through `process.env` here and through
 * request bindings in a Worker.
 *
 * With no KV bindings installed, every cache degrades to in-memory state, which is
 * exactly what this process had before.
 */
const app = express();
app.use(express.json({ limit: '256kb' }));

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));

// ===== YOUTUBE MUSIC ROUTES =====

app.get('/api/search/youtube', async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    res.json(await youtube.search(query, Math.min(Number(limit) || 20, 50)));
  } catch (error) {
    console.error('YouTube search error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ===== MULTI-SOURCE SEARCH =====
//
// `source` selects the providers:
//   all (default)  YouTube + Spotify, concurrently, merged and de-duplicated
//   youtube         YouTube only
//   spotify         Spotify only
//   auto            every provider that is actually available
//
// The response keeps the historical `{ youtube: [...] }` key so existing clients
// keep working, and adds `tracks` for the merged list. A provider that is
// unavailable, unauthenticated or rate-limited simply contributes nothing.

app.get('/api/search/all', async (req, res) => {
  try {
    const { query, limit = 20, source = 'all' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const wanted = Math.min(Math.max(Number(limit) || 20, 1), 50);

    // A single-provider request skips the merge entirely: there is nothing to
    // reconcile, and the extra pass would only cost time.
    if (source === 'youtube' || source === 'spotify') {
      const tracks = await manager.searchProvider(source, query, { limit: wanted });
      return res.json({ [source]: tracks, tracks, sources: { [source]: tracks.length }, errors: {}, merged: 0 });
    }

    const result = await manager.search(query, { sources: source, limit: wanted });

    res.json({
      youtube: result.tracks.filter((t) => t.source === 'youtube'),
      spotify: result.tracks.filter((t) => t.source === 'spotify'),
      tracks: result.tracks,
      sources: result.sources,
      errors: result.errors,
      merged: result.merged,
    });
  } catch (error) {
    console.error('Unified search error:', spotify.redact(error.message));
    res.status(500).json({ error: 'Unified search failed' });
  }
});

/** Providers available in this deployment, and which can serve audio. */
app.get('/api/providers', async (req, res) => {
  res.json(manager.status());
});

/**
 * Resolve a playable source for a track.
 *
 * This is the provider-aware playback seam: given a track from any source, it
 * returns where the audio will actually come from. A Spotify track normally
 * resolves to a matched YouTube upload, because the Spotify Web API serves no
 * audio. The response says which provider won and why, so the UI can show it
 * rather than guess.
 */
app.get('/api/play/:source/:id', async (req, res) => {
  try {
    const { source, id } = req.params;
    const preferred = String(req.query.source ?? 'auto');

    let track = await manager.getTrack(source, id);
    if (!track && source === 'spotify') {
      // Spotify ids are not resolvable without a token; a cached library record
      // can still supply the metadata, so search is the fallback.
      const results = await manager.searchProvider('spotify', id, { limit: 1 });
      track = results[0] ?? null;
    }

    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const selection = await manager.selectPlaybackProvider(track, { preferred });

    if (!selection.provider || !selection.track) {
      return res.status(404).json({
        error: 'No playable source for this track',
        reason: selection.reason,
      });
    }

    // Resolve the actual stream now, so the client gets one thing to play rather
    // than a second round trip it might fail.
    const streamUrl = await streamCache.get(selection.provider, selection.track.id)
      ?? await youtube.resolveStream(selection.track.id);

    if (!streamUrl) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }

    await streamCache.set(selection.provider, selection.track.id, streamUrl);

    res.json({
      streamUrl,
      source: selection.provider,
      reason: selection.reason,
      track: {
        ...selection.track,
        playbackProvider: selection.provider,
        playable: true,
      },
    });
  } catch (error) {
    console.error('Playback resolution error:', spotify.redact(error.message));
    res.status(500).json({ error: 'Playback resolution failed' });
  }
});

app.get('/api/stream/youtube/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Check cache
    const cached = await streamCache.get('youtube', videoId);
    if (cached) {
      return res.json({ streamUrl: cached });
    }

    const streamUrl = await youtube.resolveStream(videoId);

    if (!streamUrl) {
      return res.status(404).json({ error: 'Stream URL not found' });
    }

    // Cache it
    await streamCache.set('youtube', videoId, streamUrl);

    res.json({ streamUrl });
  } catch (error) {
    console.error('YouTube stream error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Editorial shelves backing the New/Home grids. Each row is a themed YouTube
// search, so the cards show real, playable music instead of placeholder art.
//
// The three rows that were previously hardcoded to a fixed year or a vague
// "latest" phrase — `featured` was literally `'trending songs 2026'` — are served
// by the discovery pipeline instead, which re-derives queries from the current
// date and ranks by real freshness signals. Static shelves remain here for the
// genuinely static categories (charts curation, mood, editorial).
const SHELF_QUERIES = [
  { id: 'trending', title: 'Trending Now', kind: 'editorial', query: 'trending songs' },
  { id: 'new-releases', title: 'New This Week', kind: 'album', query: 'new latest songs' },
  { id: 'recent', title: 'Recent Releases', kind: 'album', query: 'latest music releases' },
  { id: 'updated-playlists', title: 'Updated Playlists', kind: 'playlist', query: 'best playlist hits' },
  { id: 'trending', title: 'Trending Songs', kind: 'track', query: 'trending music hits' },
  { id: 'everyones-listening', title: "Everyone's Listening To…", kind: 'playlist', query: 'popular songs everyone loves' },
  { id: 'top-100', title: 'Daily Top 100', kind: 'playlist', query: 'top 100 songs' },
  { id: 'city-charts', title: 'City Charts', kind: 'playlist', query: 'bollywood hit songs' },
  { id: 'only-on', title: 'Only on This App', kind: 'album', query: 'exclusive music videos' },
  { id: 'dj-mixes', title: 'Latest DJ Mixes', kind: 'album', query: 'dj remix songs' },
  { id: 'on-tour', title: 'Now on Tour', kind: 'playlist', query: 'live concert songs' },
  { id: 'coming-soon', title: 'Coming Soon', kind: 'album', query: 'upcoming songs' },
  { id: 'best-new', title: 'Best New Songs', kind: 'track', query: 'best new songs this week' },
  { id: 'made-for-you', title: 'Made For You', kind: 'track', query: 'songs for you' },

  // Language shelves. The recommender's Malayalam/Tamil cards filter strictly
  // by script, so without these rows those cards have no candidate pool at all
  // — the generic shelves above return almost exclusively Latin-script titles.
  //
  // These do NOT trust the query. A YouTube search for "malayalam latest songs"
  // returns Tamil music in bulk, so each language shelf carries several targeted
  // queries and the rows are assembled by detecting the language of every result
  // and keeping only what actually matches. `language` is the target code;
  // `queries` widens the pool. See `lib/language/` and `getShelves`.
  {
    id: 'malayalam',
    title: 'Malayalam',
    kind: 'track',
    query: 'malayalam songs',
    language: 'ml',
    queries: [
      'malayalam music',
      'malayalam film songs',
      'malayalam hits',
      'malayalam latest songs',
      'malayalam movie songs',
      'malayalam romantic songs',
    ],
  },
  {
    id: 'malayalam-hits',
    title: 'Malayalam Hits',
    kind: 'track',
    query: 'malayalam hit songs',
    language: 'ml',
    queries: ['malayalam super hit songs', 'malayalam popular songs', 'malayalam new songs'],
  },
  {
    id: 'tamil',
    title: 'Tamil',
    kind: 'track',
    query: 'tamil songs',
    language: 'ta',
    queries: [
      'tamil music',
      'tamil film songs',
      'tamil hits',
      'tamil latest songs',
      'tamil movie songs',
      'tamil romantic songs',
    ],
  },
  {
    id: 'tamil-hits',
    title: 'Tamil Hits',
    kind: 'track',
    query: 'tamil hit songs',
    language: 'ta',
    queries: ['tamil super hit songs', 'tamil popular songs', 'tamil new songs'],
  },
  {
    id: 'hindi',
    title: 'Hindi',
    kind: 'track',
    query: 'hindi songs',
    language: 'hi',
    queries: ['hindi music', 'hindi film songs', 'hindi hits', 'hindi latest songs'],
  },
  {
    id: 'telugu',
    title: 'Telugu',
    kind: 'track',
    query: 'telugu songs',
    language: 'te',
    queries: ['telugu music', 'telugu hits', 'telugu latest songs'],
  },
  {
    id: 'kannada',
    title: 'Kannada',
    kind: 'track',
    query: 'kannada songs',
    language: 'kn',
    queries: ['kannada music', 'kannada hits', 'kannada latest songs'],
  },
  {
    id: 'bengali',
    title: 'Bengali',
    kind: 'track',
    query: 'bengali songs',
    language: 'bn',
    queries: ['bengali music', 'bengali hits', 'bangla songs'],
  },

  // Mood shelves backing the Chill and Workout cards. These queries name the
  // activity and mood rather than relying on genre tags alone.
  { id: 'chill', title: 'Chill & Relax', kind: 'playlist', query: 'chill relaxing lofi music' },
  { id: 'workout', title: 'Workout Energy', kind: 'playlist', query: 'workout gym energy music' },
  { id: 'romantic', title: 'Romantic', kind: 'playlist', query: 'romantic love songs' },
  { id: 'listen-now', title: 'Listen Now', kind: 'editorial', query: 'listen now songs' },
  { id: 'discover', title: 'Discover', kind: 'editorial', query: 'discover new music' },
];

/**
 * Shelf ids that must come from the ranked discovery pipeline.
 *
 * These three are the ones that used to show whatever a fixed-year query happened
 * to return. Serving them through discovery means the Home grid's headline rows
 * are genuinely freshness-ranked rather than merely named that way.
 */
const DISCOVERY_SHELF_IDS = new Set(['trending', 'new-releases', 'recent']);

app.get('/api/shelves', async (req, res) => {
  try {
    const limitPerShelf = Math.min(Number(req.query.limit) || 6, 12);

    // Cached with stale-while-revalidate, keyed on the limit because that changes
    // the result size.
    //
    // This route runs three discovery passes and a full editorial shelf build, each
    // of which fans out into live YouTube queries — measured at 8-28 seconds and
    // different every call. Caching it is what keeps a page navigation instant and,
    // more importantly, what stops every navigation re-querying YouTube for data
    // that has not changed. Discovery keeps its own shorter per-scope TTLs inside,
    // so the cached shelf still refreshes as often as trending does.
    const { value, age, stale, refreshing } = await discovery.shelves(
      { limitPerShelf },
      () => buildShelvesResponse(limitPerShelf, req)
    );

    // The body stays a bare array: `/api/shelves` is consumed as one by the
    // frontend, and wrapping it in an envelope silently emptied every shelf on the
    // page. Cache state is reported in headers instead.
    res.set('X-Spotuner-Cache', refreshing ? 'refreshing' : stale ? 'stale' : 'fresh');
    if (age !== null && age !== undefined) res.set('X-Spotuner-Cache-Age', String(Math.round(age)));
    res.json(value);
  } catch (error) {
    console.error('Shelves error:', error.message);
    res.status(500).json({ error: 'Failed to build shelves' });
  }
});

/**
 * Build the full shelf payload. Separated from the route so the cache wrapper has
 * a single producer to call.
 */
async function buildShelvesResponse(limitPerShelf, req) {
  const staticShelves = SHELF_QUERIES.filter((s) => !DISCOVERY_SHELF_IDS.has(s.id));

  const [discovered, built] = await Promise.all([
    Promise.all([
      discovery.getTrendingMusic({ limit: limitPerShelf, global: true }),
      discovery.getLatestMusic({ limit: limitPerShelf, global: true }),
      discovery.getLatestMusic({ limit: limitPerShelf, global: true, maxPerArtist: 3 }),
    ]),
    youtube.getShelves({ limitPerShelf, shelves: staticShelves }),
  ]);

  const [trending, newReleases, recent] = discovered;

  return finaliseShelves({ trending, newReleases, recent, built, limitPerShelf, req });
}

/**
 * Assemble the shelf list from the discovery rows and the editorial build.
 *
 * Only substitutes a discovery row when it actually produced something, so a
 * failed discovery run degrades to the plain query rather than to a gap.
 */
function finaliseShelves({ trending, newReleases, recent, built }) {
  const asShelf = (result, id, title, kind) =>
    result?.tracks?.length > 0
      ? { id, title, kind, tracks: result.tracks, source: 'discovery', generatedAt: result.generatedAt }
      : null;

  const discoveryShelves = [
    asShelf(trending, 'trending', 'Trending Now', 'editorial'),
    asShelf(newReleases, 'new-releases', 'New This Week', 'track'),
    asShelf(recent, 'recent', 'Recent Releases', 'album'),
  ].filter(Boolean);

  return [...discoveryShelves, ...built];
}

// ===== DISCOVERY: TRENDING & LATEST =====
//
// Trending and latest are separate concepts with separate endpoints, separate
// query families and separate scores. Neither is a sorted view of the other, and
// neither trusts its own query text: every track passes through the language
// classifier and a release-age assessment before it is ranked.
//
// Results are cached per scope with tiered TTLs and served stale-while-revalidate,
// so opening the app never waits on a discovery run.

const SUPPORTED_SCOPES = ['global', 'ml', 'ta', 'hi', 'te', 'kn', 'bn', 'pa', 'mr', 'gu'];

/** Parse and validate the shared query parameters for a discovery request. */
function readDiscoveryParams(req) {
  const rawScope = String(req.query.scope ?? 'global').toLowerCase();
  const scope = SUPPORTED_SCOPES.includes(rawScope) ? rawScope : 'global';

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 40);
  const maxPerArtist = Math.min(Math.max(Number(req.query.maxPerArtist) || 2, 1), 10);

  // `exclude` lets a caller deprioritise tracks it is already showing elsewhere.
  const excludeIds = String(req.query.exclude ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);

  return {
    scope,
    language: scope === 'global' ? null : scope,
    global: scope === 'global',
    limit,
    maxPerArtist,
    excludeIds,
    refresh: req.query.refresh === '1' || req.query.refresh === 'true',
  };
}

/** Clamp a numeric field from a JSON body, which unlike a query string can be anything. */
function clampLimit(value, fallback, min = 1, max = 40) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

/**
 * GET /api/discovery/trending
 *
 * Music currently receiving attention. Region-biased to India for regional
 * scopes; the global scope keeps the default locale so international music is
 * not filtered out.
 */
app.get('/api/discovery/trending', async (req, res) => {
  try {
    const params = readDiscoveryParams(req);

    const result = await discovery.getTrendingMusic(params);

    res.json({
      kind: 'trending',
      ...result,
      scope: params.scope,
    });
  } catch (error) {
    console.error('Discovery trending error:', error.message);
    res.status(500).json({ error: 'Failed to discover trending music' });
  }
});

/** GET /api/discovery/latest — recently released music. */
app.get('/api/discovery/latest', async (req, res) => {
  try {
    const params = readDiscoveryParams(req);

    const result = await discovery.getLatestMusic(params);

    res.json({
      kind: 'latest',
      ...result,
      scope: params.scope,
    });
  } catch (error) {
    console.error('Discovery latest error:', error.message);
    res.status(500).json({ error: 'Failed to discover latest releases' });
  }
});

/**
 * GET /api/discovery/home
 *
 * One round trip for the two rows Home needs. Both are fetched concurrently and
 * share the trending pool's repetition history, so the same song is far less
 * likely to appear in both rows on one load.
 */
app.get('/api/discovery/home', async (req, res) => {
  try {
    const params = readDiscoveryParams(req);

    const [trending, latest] = await Promise.all([
      discovery.getTrendingMusic(params),
      discovery.getLatestMusic({
        ...params,
        // Avoid re-showing what the trending row is already showing.
        excludeIds: params.excludeIds,
      }),
    ]);

    res.json({
      scope: params.scope,
      trending,
      latest,
    });
  } catch (error) {
    console.error('Discovery home error:', error.message);
    res.status(500).json({ error: 'Failed to discover home shelves' });
  }
});

/** GET /api/discovery/status — cache, probe and scoring configuration. */
app.get('/api/discovery/status', async (req, res) => {
  res.json({
    scopes: SUPPORTED_SCOPES,
    ...discovery.status(),
  });
});

/** POST /api/discovery/refresh — force a rebuild, bypassing the cache. */
/**
 * POST /api/discovery/foryou — personalised shelf.
 *
 * The listener profile arrives in the request body because listening history lives
 * in the browser's localStorage; there is no server-side user to look up. Only a
 * compact summary is sent — normalised affinities and skip counts, never track
 * titles, timestamps, or per-play records — so no private listening data reaches
 * the backend or any external provider.
 */
app.post('/api/discovery/foryou', async (req, res) => {
  try {
    const body = req.body ?? {};
    const profile = body.profile && typeof body.profile === 'object' ? body.profile : null;
    const scope = typeof body.scope === 'string' ? body.scope : 'global';

    const result = await discovery.getForYouMusic({
      language: scope === 'global' ? null : scope,
      global: scope === 'global',
      limit: clampLimit(body.limit, 20),
      maxPerArtist: clampLimit(body.maxPerArtist, 2, 1, 5),
      profile,
      excludeIds: Array.isArray(body.excludeIds) ? body.excludeIds.slice(0, 60) : [],
      // Enrichment is opt-out per request so a client can trade metadata depth for
      // latency without a server restart.
      enrichMetadata: body.enrich !== false,
    });

    res.json(result);
  } catch (error) {
    console.error('For You discovery error:', error.message);
    res.status(500).json({ error: 'Failed to build personalised shelf' });
  }
});

app.post('/api/artists/images', async (req, res) => {
  try {
    const names = Array.isArray(req.body?.names) ? req.body.names : [];
    // One request resolves a whole grid; an unbounded list would mean thousands
    // of upstream lookups in a single call.
    const capped = names.slice(0, 120).map((n) => String(n ?? '').slice(0, 120));
    const found = await artistImages(capped);
    res.json({ images: Object.fromEntries(found), truncated: names.length > capped.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/discovery/refresh — force a rebuild, bypassing the cache. */
app.post('/api/discovery/refresh', async (req, res) => {
  try {
    await discovery.invalidateNamespace('trending');
    await discovery.invalidateNamespace('latest');
    // Personalised shelves are keyed by profile, so they are invalidated wholesale
    // rather than per listener.
    await discovery.invalidateNamespace('foryou');
    // The assembled shelf payload caches its own copy of the rows above.
    await discovery.invalidateNamespace('shelves');
    // Multi-source search results too: they can be populated while a provider is
    // unconfigured or unauthenticated, and would otherwise keep serving the
    // single-source result after the provider comes up.
    await discovery.invalidateNamespace('search');
    res.json({ refreshed: true, at: new Date().toISOString() });
  } catch (error) {
    console.error('Discovery refresh error:', error.message);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

// ===== LANGUAGE DETECTION =====
// Debug/diagnostic surface for the detector. Kept as a first-class route so the
// pipeline can be inspected from outside the process without a console attached.

app.get('/api/language/status', async (req, res) => {
  res.json({
    metadataLayer: {
      available: language.metadata.isAvailable(),
      reason: language.metadata.unavailableReason(),
    },
    weights: language.WEIGHTS,
    bands: language.BANDS,
    minConfidence: language.MIN_CONFIDENCE,
    cache: language.cache.stats(),
    debugLogging: language.debug.isEnabled(),
  });
});

/** Re-run detection over a set of tracks supplied by the caller. */
app.post('/api/language/detect', async (req, res) => {
  try {
    const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks : null;
    const searchContexts = Array.isArray(req.body?.searchContexts) ? req.body.searchContexts : [];

    if (!tracks || tracks.length === 0) {
      return res.status(400).json({ error: 'tracks is required and must be a non-empty array' });
    }

    const results = await language.annotate(tracks.slice(0, 100), {
      searchContexts: searchContexts.map((code) => language.normalizeCode(code)),
    });

    res.json({ results, summary: language.summarize(results) });
  } catch (error) {
    console.error('Language detect error:', error.message);
    res.status(500).json({ error: 'Language detection failed' });
  }
});

// ===== HERO IMAGE MATCHER =====

// Resolves a hero/banner image for one or many pieces of content. Accepts a
// single object or an array so the carousel can resolve every slide in one
// request and have visual diversity applied across the whole set.
app.post('/api/hero-image', async (req, res) => {
  try {
    const body = req.body ?? {};
    const raw = Array.isArray(body.items) ? body.items : [body];

    if (raw.length === 0) {
      return res.status(400).json({ error: 'items is required' });
    }

    // Bound the work per request so a bad client cannot fan out indefinitely.
    const items = raw.slice(0, 12).map(toMatcherInput);

    const results = Array.isArray(body.items)
      ? await matchHeroImages(items)
      : [await matchHeroImage(items[0])];

    res.json({ results });
  } catch (error) {
    console.error('Hero image match error:', error.message);
    res.status(500).json({ error: 'Hero image match failed' });
  }
});

// ===== HEALTH CHECK =====

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎵 Music API server running on port ${PORT}`);
});
