import { Hono } from 'hono';

import * as youtube from '../../lib/youtube.js';
import * as discovery from '../../lib/discovery/index.js';
import * as swrcache from '../../lib/discovery/swrcache.js';

import { SHELF_QUERIES, DISCOVERY_SHELF_IDS } from '../shelves.data.js';

/**
 * `GET /api/shelves`
 *
 * The response is a **bare array** of shelves. This is the one contract in the API
 * that cannot be wrapped in an envelope: the frontend consumes it as one, and an
 * earlier attempt to wrap it silently emptied every shelf on the page. Cache state
 * is reported in headers instead.
 *
 * This route runs three discovery passes and a full editorial shelf build, each of
 * which fans out into live YouTube queries — measured at 8-28 seconds. Caching it
 * is what keeps a page navigation instant and, more importantly, what stops every
 * navigation re-querying YouTube for data that has not changed. Discovery keeps its
 * own shorter per-scope TTLs inside, so the cached shelf still refreshes as often as
 * trending does.
 */
const app = new Hono();

app.get('/shelves', async (c) => {
  try {
    const limitPerShelf = Math.min(Number(c.req.query('limit')) || 6, 12);

    const { value, age, stale, refreshing } = await discovery.shelves(
      { limitPerShelf },
      () => buildShelvesResponse(limitPerShelf),
    );

    c.header('X-Spotuner-Cache', refreshing ? 'refreshing' : stale ? 'stale' : 'fresh');
    if (age !== null && age !== undefined) c.header('X-Spotuner-Cache-Age', String(Math.round(age)));

    // A background revalidation started by this request has to outlive the
    // response for its KV write to land. `waitUntil` is how a Worker says "keep
    // this isolate alive"; it is unavailable when the app is invoked without a real
    // execution context (unit tests), which is why it is guarded.
    try {
      c.executionCtx.waitUntil(swrcache.drain());
    } catch {
      // No execution context: the refresh simply is not tracked past the response.
    }

    return c.json(value);
  } catch (error: any) {
    console.error('Shelves error:', error?.message);
    return c.json({ error: 'Failed to build shelves' }, 500);
  }
});

/**
 * Build the full shelf payload. Separated from the route so the cache wrapper has a
 * single producer to call.
 */
async function buildShelvesResponse(limitPerShelf: number) {
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

  return finaliseShelves({ trending, newReleases, recent, built });
}

/**
 * Assemble the shelf list from the discovery rows and the editorial build.
 *
 * Only substitutes a discovery row when it actually produced something, so a
 * failed discovery run degrades to the plain query rather than to a gap.
 */
function finaliseShelves({ trending, newReleases, recent, built }: any) {
  const asShelf = (result: any, id: string, title: string, kind: string) =>
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

export default app;