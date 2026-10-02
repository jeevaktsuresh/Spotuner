import { Hono } from 'hono';

import * as language from '../../lib/language/index.js';

/**
 * Language detection routes.
 *
 * Debug/diagnostic surface for the detector, kept as a first-class route so the
 * pipeline can be inspected from outside the Worker without a console attached.
 * The detector itself is the Spotuner pipeline — script measurement, lexicon
 * evidence, weights, bands and a memoised cache — not a generic language service,
 * because it exists specifically to stop Tamil tracks appearing on Malayalam
 * shelves and the reverse.
 */
const app = new Hono();

app.get('/language/status', (c) =>
  c.json({
    metadataLayer: {
      available: language.metadata.isAvailable(),
      reason: language.metadata.unavailableReason(),
    },
    weights: language.WEIGHTS,
    bands: language.BANDS,
    minConfidence: language.MIN_CONFIDENCE,
    cache: language.cache.stats(),
    debugLogging: language.debug.isEnabled(),
  }),
);

/** Re-run detection over a set of tracks supplied by the caller. */
app.post('/language/detect', async (c) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const tracks = Array.isArray(body?.tracks) ? body.tracks : null;
    const searchContexts = Array.isArray(body?.searchContexts) ? body.searchContexts : [];

    if (!tracks || tracks.length === 0) {
      return c.json({ error: 'tracks is required and must be a non-empty array' }, 400);
    }

    const results = await language.annotate(tracks.slice(0, 100), {
      searchContexts: searchContexts.map((code: unknown) => language.normalizeCode(code as string)),
    });

    return c.json({ results, summary: language.summarize(results) });
  } catch (error: any) {
    console.error('Language detect error:', error?.message);
    return c.json({ error: 'Language detection failed' }, 500);
  }
});

export default app;