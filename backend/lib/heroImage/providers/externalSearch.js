import { buildQueries } from '../queries.js';
import { envStr } from '../../runtime/env.js';

/**
 * ExternalImageSearchProvider — pluggable general image search.
 *
 * No keyless public image-search endpoint exists, so this provider is inert
 * until `HERO_IMAGE_SEARCH_URL` is configured. It is deliberately a thin
 * adapter around one HTTP contract rather than a hard-coded vendor, so a
 * deployment can point it at Bing / Google / SerpAPI without touching the
 * matcher.
 *
 * Expected response shape (a small subset of most image-search APIs):
 *
 *   { "images": [{ "url", "title", "source", "width", "height", ... }] }
 *
 * A deployment may instead supply an endpoint returning a bare array. Both are
 * accepted.
 */

/** Match the configured endpoint into the internal candidate shape. */
function toCandidate(raw, query, intent, weight) {
  if (!raw?.url) return null;

  const host = (() => {
    try {
      return new URL(raw.url).hostname;
    } catch {
      return '';
    }
  })();

  const stockHosts = ['shutterstock', 'gettyimages', 'istockphoto', 'alamy', 'dreamstime'];
  const isStock = stockHosts.some((known) => host.includes(known));

  return {
    url: raw.url,
    title: raw.title ?? raw.name ?? '',
    artist: raw.artist ?? raw.creator ?? '',
    album: raw.album ?? '',
    imageType: intent === 'artist' ? 'artist_image' : 'promotional',
    source: raw.source ?? host ?? 'external-search',
    official: Boolean(raw.official),
    stock: isStock,
    watermarked: Boolean(raw.watermarked) || isStock,

    // Trust the API's own dimensions when supplied; the probe will confirm.
    probed:
      raw.width && raw.height
        ? { ok: true, width: raw.width, height: raw.height, format: raw.format ?? 'unknown' }
        : undefined,

    queryWeight: weight,
  };
}

export default {
  name: 'external-search',

  get enabled() {
    return Boolean(envStr('HERO_IMAGE_SEARCH_URL'));
  },

  async find(metadata) {
    const endpoint = envStr('HERO_IMAGE_SEARCH_URL');
    if (!endpoint) return [];

    const apiKey = envStr('HERO_IMAGE_SEARCH_KEY');
    const plan = buildQueries(metadata);

    const candidates = [];

    // Only the three highest-intent queries are sent; the rest rarely help.
    for (const { query, weight, intent } of plan.slice(0, 3)) {
      try {
        const url = new URL(endpoint);
        url.searchParams.set('q', query);
        url.searchParams.set('safe', 'active');
        if (apiKey) url.searchParams.set('key', apiKey);

        const response = await fetch(url, {
          headers: { 'User-Agent': 'Spotuner/1.0 (+hero-image-matcher)' },
          signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) continue;

        const payload = await response.json();
        const images = Array.isArray(payload) ? payload : (payload.images ?? payload.value ?? []);

        for (const raw of images.slice(0, 12)) {
          const candidate = toCandidate(raw, query, intent, weight);
          if (candidate) candidates.push(candidate);
        }
      } catch {
        // A failed search must never break the matcher.
      }
    }

    return candidates;
  },
};