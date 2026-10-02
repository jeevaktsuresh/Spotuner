import { Hono } from 'hono';

import { artistImages } from '../../lib/artists.js';
import * as spotify from '../../lib/metadata/providers/spotify.js';

/**
 * `POST /api/artists/images`
 *
 * One request resolves a whole grid of artist portraits from the keyless iTunes
 * Search API. The catalogue lives in Cloudflare KV, so coverage accumulates across
 * isolates and deploys instead of restarting from zero on every cold start.
 */
const app = new Hono();

app.post('/artists/images', async (c) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const names = Array.isArray(body?.names) ? body.names : [];
    // One request resolves a whole grid; an unbounded list would mean thousands
    // of upstream lookups in a single call.
    const capped = names.slice(0, 120).map((n: unknown) => String(n ?? '').slice(0, 120));
    const found = await artistImages(capped);

    return c.json({
      images: Object.fromEntries(found),
      truncated: names.length > capped.length,
    });
  } catch (error: any) {
    // Redacted for the same reason the search route is: an upstream error message
    // should never be able to carry a credential into a response.
    return c.json({ error: spotify.redact(error?.message) }, 500);
  }
});

export default app;