import { useEffect, useMemo, useState } from 'react';
import { musicApi } from '../services/api';

/**
 * Shared shelf data, and the in-flight request for it.
 *
 * Five pages read the shelves — Home, Browse, Albums, New and Radio — and three of
 * them ask for the same limit. Without this, walking Home -> Browse -> Albums
 * issued three identical `/api/shelves` requests and re-rendered each page's grid
 * from scratch on the way.
 *
 * Two mechanisms, because they answer different questions:
 *
 *   inFlight  concurrent callers share one request. This is behaviour-preserving:
 *             a second caller would have received the same payload, so it now
 *             awaits the promise already in flight instead of issuing its own.
 *   cache     sequential callers within `TTL_MS` reuse the last payload. The
 *             backend builds shelves from YouTube search and holds them in
 *             process memory with no TTL, so the client reusing them for a few
 *             minutes is not serving data any fresher than the server would have.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** limit -> { shelves, at } */
const cache = new Map();
/** limit -> Promise, removed as soon as it settles. */
const inFlight = new Map();

function readCache(limit) {
  const hit = cache.get(limit);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(limit);
    return null;
  }
  return hit.shelves;
}

/**
 * Drop the shared shelves, so the next reader refetches.
 *
 * Exported for the rare case where a caller knows the server has new data — the
 * catalogue changes only when the backend's own cache is dropped, so nothing in
 * the app calls this today.
 */
export function invalidateShelves() {
  cache.clear();
}

function fetchShelves(limit) {
  const cached = readCache(limit);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(limit);
  if (pending) return pending;

  const request = musicApi
    .getShelves(limit)
    .then((data) => {
      const shelves = Array.isArray(data) ? data : [];
      cache.set(limit, { shelves, at: Date.now() });
      return shelves;
    })
    .finally(() => {
      inFlight.delete(limit);
    });

  inFlight.set(limit, request);
  return request;
}

/**
 * Loads the editorial shelves from the backend.
 *
 * The shelves are built server-side from YouTube search, so the grid renders
 * real, playable tracks. Falls back to an empty list on failure, which the
 * pages surface as an empty state rather than placeholder art.
 */
export default function useShelves(limitPerShelf = 6) {
  const [shelves, setShelves] = useState(() => readCache(limitPerShelf) ?? []);
  const [loading, setLoading] = useState(() => readCache(limitPerShelf) === null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // No cache handling here: the initial state above is seeded from the cache, so
    // a warm one never shows the loading skeleton, and `fetchShelves` resolves
    // from the same cache anyway. Setting state synchronously to re-read it would
    // only add a render.

    async function load() {
      try {
        const data = await fetchShelves(limitPerShelf);
        if (!cancelled) setShelves(data);
      } catch (err) {
        console.error('Failed to load shelves:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [limitPerShelf]);

  /** Find a shelf by id. Stable, so it can be a dependency of a memo. */
  const getShelf = useMemo(
    () => (id) => shelves.find((shelf) => shelf.id === id),
    [shelves]
  );

  return { shelves, getShelf, loading, error };
}