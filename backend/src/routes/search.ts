import { Hono } from 'hono';

import * as youtube from '../../lib/youtube.js';
import * as manager from '../../lib/metadata/manager.js';
import * as spotify from '../../lib/metadata/providers/spotify.js';

/**
 * Search routes.
 *
 * `source` selects the providers:
 *   all (default)  YouTube + Spotify, concurrently, merged and de-duplicated
 *   youtube         YouTube only
 *   spotify         Spotify only
 *   auto            every provider that is actually available
 *
 * The response keeps the historical `{ youtube: [...] }` key so existing clients
 * keep working, and adds `tracks` for the merged list. A provider that is
 * unavailable, unauthenticated or rate-limited simply contributes nothing.
 */
const app = new Hono();

app.get('/search/youtube', async (c) => {
  try {
    const query = c.req.query('query');
    const limit = c.req.query('limit');

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    return c.json(await youtube.search(query, Math.min(Number(limit) || 20, 50)));
  } catch (error: any) {
    console.error('YouTube search error:', error?.message);
    return c.json({ error: 'Search failed' }, 500);
  }
});

app.get('/search/all', async (c) => {
  try {
    const query = c.req.query('query');
    const limit = c.req.query('limit') ?? 20;
    const source = c.req.query('source') ?? 'all';

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const wanted = Math.min(Math.max(Number(limit) || 20, 1), 50);

    // A single-provider request skips the merge entirely: there is nothing to
    // reconcile, and the extra pass would only cost time.
    if (source === 'youtube' || source === 'spotify') {
      const tracks = await manager.searchProvider(source, query, { limit: wanted });
      return c.json({ [source]: tracks, tracks, sources: { [source]: tracks.length }, errors: {}, merged: 0 });
    }

    const result = await manager.search(query, { sources: source, limit: wanted });

    return c.json({
      youtube: result.tracks.filter((t: any) => t.source === 'youtube'),
      spotify: result.tracks.filter((t: any) => t.source === 'spotify'),
      tracks: result.tracks,
      sources: result.sources,
      errors: result.errors,
      merged: result.merged,
    });
  } catch (error: any) {
    console.error('Unified search error:', spotify.redact(error?.message));
    return c.json({ error: 'Unified search failed' }, 500);
  }
});

/** Providers available in this deployment, and which can serve audio. */
app.get('/providers', (c) => c.json(manager.status()));

export default app;