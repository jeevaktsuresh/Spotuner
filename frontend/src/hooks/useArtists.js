import { useEffect, useMemo, useRef, useState } from 'react';
import useShelves from './useShelves';
import { artistsFromTracks, artistSlug } from '../utils/artists';
import { musicApi } from '../services/api';

/**
 * How many artist images to request per call.
 *
 * There is no way to render the grid in one shot: each name costs an upstream
 * lookup, and the catalogue rolls up to ~300 artists. Fetching in small batches
 * lets the first screenful resolve quickly and the rest stream in behind it,
 * rather than holding the whole grid on the slowest artist.
 */
const BATCH = 24;
/**
 * Rolls every shelf track up into individual artists.
 *
 * Exposed as a hook so the Artists list and the per-artist detail page derive
 * their data identically — an artist reached from the list and one opened by URL
 * must show the same song count, which they only will if the rollup is shared.
 *
 * @param {number} [shelvesLimit]
 */
export default function useArtists(shelvesLimit = 10) {
  const { shelves, loading, error } = useShelves(shelvesLimit);
  const [resolved, setResolved] = useState({});

  // Names already requested, so revisiting the page (or a re-render) does not
  // re-ask for pictures that are already in hand or already known to be missing.
  const attempted = useRef(new Set());

  const tracks = useMemo(() => shelves.flatMap((shelf) => shelf.tracks ?? []), [shelves]);

  const rolled = useMemo(() => artistsFromTracks(tracks), [tracks]);

  // A stable identity for the set of names still showing a track cover, used as
  // the effect's only dependency so a new array each render cannot retrigger the
  // loop. Names are whitespace-collapsed during splitting, so joining on a
  // newline is unambiguous.
  //
  // This keys off `isPlaceholder`, not `image`: every artist carries a track
  // cover, so filtering on `image` would skip every lookup and no artist would
  // ever receive a real picture. `attempted` is read inside the effect, never
  // during render.
  const wantedKey = useMemo(
    () => rolled.filter((a) => a.isPlaceholder).map((a) => a.name).join('\n'),
    [rolled]
  );

  useEffect(() => {
    if (loading || !wantedKey) return undefined;

    const names = wantedKey.split('\n');
    let cancelled = false;

    (async () => {
      for (let i = 0; i < names.length; i += BATCH) {
        if (cancelled) return;
        const slice = names.slice(i, i + BATCH).filter((n) => !attempted.current.has(n));
        if (slice.length === 0) continue;
        for (const n of slice) attempted.current.add(n);

        try {
          const images = await musicApi.getArtistImages(slice);
          if (cancelled) return;
          // Merge rather than replace: an earlier batch may still be in flight.
          setResolved((prev) => ({ ...prev, ...images }));
        } catch {
          // Leave this batch unresolved; the rollup already carries a track
          // thumbnail as the placeholder, so a failure is not visible as a gap.
          // Names stay in `attempted` so one outage does not retry in a loop.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wantedKey, loading]);

  const artists = useMemo(
    () =>
      rolled.map((artist) => {
        const real = resolved[artist.name];
        // A resolved picture replaces the cover and clears the placeholder flag;
        // an unresolved one keeps the cover.
        return real ? { ...artist, image: real, isPlaceholder: false } : artist;
      }),
    [rolled, resolved]
  );

  /**
   * Look up one artist by its route slug, tolerating both the hyphenated form
   * (/artists/anirudh-ravichander) and a literal space (/artists/anirudh%20...).
   */
  function findArtist(slug) {
    if (!slug) return null;
    const wantedSlug = artistSlug(slug);
    return artists.find((artist) => artistSlug(artist.key) === wantedSlug) ?? null;
  }

  return { artists, tracks, findArtist, loading, error };
}
