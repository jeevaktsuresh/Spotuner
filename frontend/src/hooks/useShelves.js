import { useEffect, useState } from 'react';
import { musicApi } from '../services/api';

/**
 * Loads the editorial shelves from the backend.
 *
 * The shelves are built server-side from YouTube search, so the grid renders
 * real, playable tracks. Falls back to an empty list on failure, which the
 * pages surface as an empty state rather than placeholder art.
 */
export default function useShelves(limitPerShelf = 6) {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await musicApi.getShelves(limitPerShelf);
        if (!cancelled) setShelves(Array.isArray(data) ? data : []);
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

  /** Find a shelf by id. */
  const getShelf = (id) => shelves.find((shelf) => shelf.id === id);

  return { shelves, getShelf, loading, error };
}
