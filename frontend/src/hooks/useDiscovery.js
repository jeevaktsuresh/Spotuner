import { useEffect, useRef, useState } from 'react';
import { musicApi } from '../services/api';

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
  const [data, setData] = useState({ trending: null, latest: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cache key includes scope and limit, so switching scope cannot show the
  // previous scope's rows while the new ones load.
  const cacheKey = `${scope}:${limit}`;
  const cache = useRef({ key: null, value: null, at: 0 });

  useEffect(() => {
    let cancelled = false;

    const cached = cache.current;
    if (cached.key === cacheKey && cached.value && Date.now() - cached.at < ttlMs) {
      setData(cached.value);
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

        cache.current = { key: cacheKey, value: next, at: Date.now() };
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
  }, [scope, limit, cacheKey, ttlMs]);

  /** Drop the browser copy so the next mount refetches. */
  function refresh() {
    cache.current = { key: null, value: null, at: 0 };
  }

  return {
    trendingTracks: data.trending?.tracks ?? [],
    latestTracks: data.latest?.tracks ?? [],
    trendingMeta: data.trending,
    latestMeta: data.latest,
    loading,
    error,
    refresh,
  };
}