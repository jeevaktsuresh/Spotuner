import { useEffect, useMemo, useState } from 'react';
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
 * Artist name -> resolved image, shared across every mount of this hook.
 *
 * Both of these used to be per-instance: a `useRef` set of attempted names and a
 * `useState` map of results. That is correct for one mount and wrong for the
 * second, because unmounting threw both away — so navigating Artists -> an artist
 * -> back to Artists re-issued an upstream lookup for every name in the rollup,
 * a few hundred names in batches of 24.
 *
 * Moving them to module scope means a remount starts from what is already known
 * and asks only for names it has never seen. An artist's picture is an immutable
 * fact, so reusing one cannot serve stale art; failures are cached too, which is
 * what the old `attempted` set did, just for one mount instead of forever.
 */
const IMAGE_CACHE = new Map();

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
  // Seeded from the shared cache so a remount paints real art on its first render
  // instead of placeholders while the batches are re-requested.
  const [resolved, setResolved] = useState(() => new Map(IMAGE_CACHE));

  const tracks = useMemo(() => shelves.flatMap((shelf) => shelf.tracks ?? []), [shelves]);

  const rolled = useMemo(() => artistsFromTracks(tracks), [tracks]);

  // A stable identity for the set of names still showing a track cover, used as
  // the effect's only dependency so a new array each render cannot retrigger the
  // loop. Names are whitespace-collapsed during splitting, so joining on a
  // newline is unambiguous.
  //
  // This keys off `isPlaceholder`, not `image`: every artist carries a track
  // cover, so filtering on `image` would skip every lookup and no artist would
  // ever receive a real picture. `IMAGE_CACHE` is read inside the effect, never
  // during render.
  const wantedKey = useMemo(
    () =>
      rolled
        .filter((a) => a.isPlaceholder && !IMAGE_CACHE.has(a.name))
        .map((a) => a.name)
        .join('\n'),
    [rolled]
  );

  useEffect(() => {
    if (loading || !wantedKey) return undefined;

    const names = wantedKey.split('\n');
    let cancelled = false;

    (async () => {
      for (let i = 0; i < names.length; i += BATCH) {
        if (cancelled) return;
        // Skip names another mount resolved while this loop was between batches.
        const slice = names.slice(i, i + BATCH).filter((n) => !IMAGE_CACHE.has(n));
        if (slice.length === 0) continue;

        try {
          const images = await musicApi.getArtistImages(slice);
          if (cancelled) return;
          for (const [name, url] of Object.entries(images)) {
            IMAGE_CACHE.set(name, url);
          }
          // Merge rather than replace: an earlier batch may still be in flight.
          setResolved((prev) => {
            const next = new Map(prev);
            for (const [name, url] of Object.entries(images)) next.set(name, url);
            return next;
          });
        } catch {
          // Leave this batch unresolved; the rollup already carries a track
          // thumbnail as the placeholder, so a failure is not visible as a gap.
          // Marked as seen so one outage does not retry in a loop.
          for (const name of slice) IMAGE_CACHE.set(name, null);
          setResolved((prev) => {
            const next = new Map(prev);
            for (const name of slice) if (!next.has(name)) next.set(name, null);
            return next;
          });
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
        const real = resolved.get(artist.name);
        // A resolved picture replaces the cover and clears the placeholder flag;
        // an unresolved one (including a cached failure, held as null) keeps the
        // cover.
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
