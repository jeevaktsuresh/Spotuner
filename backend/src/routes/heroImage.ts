import { Hono } from 'hono';

import { matchHeroImage, matchHeroImages, toMatcherInput } from '../../lib/heroImage/index.js';

/**
 * Hero image matcher route.
 *
 * Resolves a hero/banner image for one or many pieces of content. Accepts a single
 * object or an array so the carousel can resolve every slide in one request and
 * have visual diversity applied across the whole set.
 *
 * The matching algorithm, its provider chain and its confidence floor are
 * unchanged — only the cache underneath them moved to KV.
 */
const app = new Hono();

app.post('/hero-image', async (c) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const raw = Array.isArray(body.items) ? body.items : [body];

    if (raw.length === 0) {
      return c.json({ error: 'items is required' }, 400);
    }

    // Bound the work per request so a bad client cannot fan out indefinitely.
    const items = raw.slice(0, 12).map(toMatcherInput);

    const results = Array.isArray(body.items)
      ? await matchHeroImages(items)
      : [await matchHeroImage(items[0])];

    return c.json({ results });
  } catch (error: any) {
    console.error('Hero image match error:', error?.message);
    return c.json({ error: 'Hero image match failed' }, 500);
  }
});

export default app;