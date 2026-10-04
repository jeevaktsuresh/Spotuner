import { useCallback, useEffect, useState } from 'react';
import { musicApi } from '../services/api';

/**
 * Browser copy of the discovery rows, shared across mounts.
 *
 * This was a `useRef`, which is per-instance: it served its purpose for one mount
 * and then vanished, so walking Home -> Browse -> Home issued the request twice.
 * Keyed by `${scope}:${limit}` exactly as before, so switching scope still cannot
 * show the previous scope's rows while the new ones load.
 *
 * Shared rather than per-instance because the backend already caches these with
 * tiered TTLs and serves stale-while-revalidate — the client copy saves a round
 * trip, it does not make the data any fresher than the server would have.
 */
const CACHE = new Map();

/** Drop the shared copy so the next mount refetches. */
export function invalidateDiscovery(cacheKey) {
  if (cacheKey) CACHE.delete(cacheKey);
  else CACHE.clear();
}

/**
 * Loads the discovery rows (trending and latest) for the Home grid.
 *
 * Two behaviours matter here:
 *
 *   1. `key`-scoped caching in the browser. Without it, every navigation to Home
 *      fires a new request. The backend already caches with tiered TTLs and
 *      serves stale-while-revalidate, so re-requesting would not be expensive —
 *      but it would still be noise, and it would defeat the "do not call the API
 *      every time the user navigates" requirement.
 *
 *   2. A `refresh()` that invalidates the local copy only. The backend keeps its
 *      own longer-lived entry, so a manual refresh is cheap.
 *
 * @param {object} [options]
 * @param {string} [options.scope]   'global' or a language code
 * @param {number} [options.limit]
 * @param {number} [options.ttlMs]   how long the browser copy stays fresh
 */
export default function useDiscovery({
  scope = 'global',
  limit = 12,
  ttlMs = 5 * 60 * 1000,
} = {}) {
  // Cache key includes scope and limit, so switching scope cannot show the
  // previous scope's rows while the new ones load.
  const cacheKey = `${scope}:${limit}`;

  const readCache = () => {
    const hit = CACHE.get(cacheKey);
    if (!hit) return null;
    if (Date.now() - hit.at >= ttlMs) {
      CACHE.delete(cacheKey);
      return null;
    }
    return hit.value;
  };

  // Seeded from the shared cache so returning to Home paints its rows on the first
  // render instead of a skeleton.
  const [data, setData] = useState(() => readCache() ?? { trending: null, latest: null });
  const [loading, setLoading] = useState(() => readCache() === null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache();
    if (cached) {
      setData(cached);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function load() {
      try {
        const result = await musicApi.getDiscoveryHome({ scope, limit });

        if (cancelled) return;

        const next = {
          trending: result.trending,
          latest: result.latest,
        };

        CACHE.set(cacheKey, { value: next, at: Date.now() });
        setData(next);
        setError(null);
      } catch (err) {
        console.error('Failed to load discovery:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, limit, cacheKey, ttlMs]);

  /** Drop the browser copy so the next mount refetches. */
  const refresh = useCallback(() => {
    invalidateDiscovery(cacheKey);
  }, [cacheKey]);

  return {
    trendingTracks: data.trending?.tracks ?? EMPTY,
    latestTracks: data.latest?.tracks ?? EMPTY,
    trendingMeta: data.trending,
    latestMeta: data.latest,
    loading,
    error,
    refresh,
  };
}

/**
 * Shared empty array, so a page that renders before discovery lands does not
 * hand every row a fresh `[]` and re-render itself on each parent render.
 */
const EMPTY = [];