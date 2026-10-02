import { Hono } from 'hono';

import * as discovery from '../../lib/discovery/index.js';

/**
 * Discovery: trending & latest.
 *
 * Trending and latest are separate concepts with separate endpoints, separate query
 * families and separate scores. Neither is a sorted view of the other, and neither
 * trusts its own query text: every track passes through the language classifier and a
 * release-age assessment before it is ranked.
 *
 * Results are cached per scope with tiered TTLs and served stale-while-revalidate,
 * so opening the app never waits on a discovery run.
 */

const SUPPORTED_SCOPES = ['global', 'ml', 'ta', 'hi', 'te', 'kn', 'bn', 'pa', 'mr', 'gu'];

/** Parse and validate the shared query parameters for a discovery request. */
function readDiscoveryParams(c: any) {
  const rawScope = String(c.req.query('scope') ?? 'global').toLowerCase();
  const scope = SUPPORTED_SCOPES.includes(rawScope) ? rawScope : 'global';

  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 40);
  const maxPerArtist = Math.min(Math.max(Number(c.req.query('maxPerArtist')) || 2, 1), 10);

  // `exclude` lets a caller deprioritise tracks it is already showing elsewhere.
  const excludeIds = String(c.req.query('exclude') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);

  const refresh = c.req.query('refresh');

  return {
    scope,
    language: scope === 'global' ? null : scope,
    global: scope === 'global',
    limit,
    maxPerArtist,
    excludeIds,
    refresh: refresh === '1' || refresh === 'true',
  };
}

/** Clamp a numeric field from a JSON body, which unlike a query string can be anything. */
function clampLimit(value: unknown, fallback: number, min = 1, max = 40) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

/**
 * Read a JSON body, rejecting anything malformed with the same 400 shape the
 * detection routes already use. `express.json()` answered 400 on unparseable
 * input; Hono would otherwise throw a parse error into the global handler.
 */
async function readBody(c: any): Promise<Record<string, any> | null> {
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return null;
  }
}

const app = new Hono();

/**
 * `GET /api/discovery/trending`
 *
 * Music currently receiving attention. Region-biased to India for regional scopes;
 * the global scope keeps the default locale so international music is not filtered
 * out.
 */
app.get('/discovery/trending', async (c) => {
  try {
    const params = readDiscoveryParams(c);

    const result = await discovery.getTrendingMusic(params);

    return c.json({
      kind: 'trending',
      ...result,
      scope: params.scope,
    });
  } catch (error: any) {
    console.error('Discovery trending error:', error?.message);
    return c.json({ error: 'Failed to discover trending music' }, 500);
  }
});

/** `GET /api/discovery/latest` — recently released music. */
app.get('/discovery/latest', async (c) => {
  try {
    const params = readDiscoveryParams(c);

    const result = await discovery.getLatestMusic(params);

    return c.json({
      kind: 'latest',
      ...result,
      scope: params.scope,
    });
  } catch (error: any) {
    console.error('Discovery latest error:', error?.message);
    return c.json({ error: 'Failed to discover latest releases' }, 500);
  }
});

/**
 * `GET /api/discovery/home`
 *
 * One round trip for the two rows Home needs. Both are fetched concurrently and
 * share the trending pool's repetition history, so the same song is far less likely
 * to appear in both rows on one load.
 */
app.get('/discovery/home', async (c) => {
  try {
    const params = readDiscoveryParams(c);

    const [trending, latest] = await Promise.all([
      discovery.getTrendingMusic(params),
      discovery.getLatestMusic({
        ...params,
        // Avoid re-showing what the trending row is already showing.
        excludeIds: params.excludeIds,
      }),
    ]);

    return c.json({
      scope: params.scope,
      trending,
      latest,
    });
  } catch (error: any) {
    console.error('Discovery home error:', error?.message);
    return c.json({ error: 'Failed to discover home shelves' }, 500);
  }
});

/** `GET /api/discovery/status` — cache, probe and scoring configuration. */
app.get('/discovery/status', (c) =>
  c.json({
    scopes: SUPPORTED_SCOPES,
    ...discovery.status(),
  }),
);

/**
 * `POST /api/discovery/foryou` — personalised shelf.
 *
 * The listener profile arrives in the request body because listening history lives
 * in the browser's localStorage; there is no server-side user to look up. Only a
 * compact summary is sent — normalised affinities and skip counts, never track
 * titles, timestamps, or per-play records — so no private listening data reaches the
 * backend or any external provider. That stays true here: the profile is used for
 * ranking and is not stored anywhere.
 */
app.post('/discovery/foryou', async (c) => {
  try {
    const body = (await readBody(c)) ?? {};
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

    return c.json(result);
  } catch (error: any) {
    console.error('For You discovery error:', error?.message);
    return c.json({ error: 'Failed to build personalised shelf' }, 500);
  }
});

/** `POST /api/discovery/refresh` — force a rebuild, bypassing the cache. */
app.post('/discovery/refresh', async (c) => {
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
    return c.json({ refreshed: true, at: new Date().toISOString() });
  } catch (error: any) {
    console.error('Discovery refresh error:', error?.message);
    return c.json({ error: 'Refresh failed' }, 500);
  }
});

export { SUPPORTED_SCOPES };
export default app;