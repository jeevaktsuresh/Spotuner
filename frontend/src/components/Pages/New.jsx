import { useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useShelves from '../../hooks/useShelves';
import ShelfRow from '../Layout/ShelfRow';
import Shelf from '../Layout/Shelf';
import SectionHeading from '../Layout/SectionHeading';
import HeroCard from '../Cards/HeroCard';
import SquareLockup from '../Cards/SquareLockup';
import TrackLockup from '../Cards/TrackLockup';

function ShelfSkeleton() {
  return (
    <ShelfRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="w-[160px] shrink-0 sm:w-[184px]">
          <div className="aspect-square w-full animate-pulse rounded-[12px] bg-white/5" />
          <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </ShelfRow>
  );
}

/**
 * New — the releases browse page.
 *
 * Same shelf data as Home, presented as a continuous catalogue: a hero, the
 * newest songs as dense rows, then every remaining shelf as cards.
 */
export default function NewPage() {
  const { shelves, loading, error } = useShelves(8);
  const { recentlyPlayed, likedSongs } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const featured = shelves.find((s) => s.id === 'featured') ?? null;
  const featuredTrack = featured?.tracks?.[0] ?? null;
  const bestNew = shelves.find((s) => s.id === 'best-new') ?? null;
  const rest = shelves.filter((s) => s.id !== 'featured' && s.id !== 'best-new');

  const libraryTracks = useMemo(
    () => [...recentlyPlayed, ...likedSongs].filter(Boolean),
    [recentlyPlayed, likedSongs],
  );

  function play(items, item) {
    setQueue(items);
    playTrack(item);
  }

  function isThisPlaying(item) {
    return isPlaying && currentTrack?.id === item?.id && currentTrack?.source === item?.source;
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="h-9 w-48 animate-pulse rounded bg-white/5" />
        <div className="mt-8">
          <ShelfSkeleton />
        </div>
      </div>
    );
  }

  if (error || shelves.length === 0) {
    return (
      <div className="page-shell py-24 text-center">
        <p className="text-[15px] font-medium text-white/80">Couldn't load music right now</p>
        <p className="mt-1.5 text-[13px] text-label-secondary">
          The backend needs to be running on port 3001.
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="pb-2">
        <h1 className="text-[26px] font-bold leading-none tracking-tight text-white sm:text-[30px]">
          New
        </h1>
        <p className="mt-2 text-[13px] text-label-secondary">
          The latest releases, updated every week.
        </p>
      </header>

      {featuredTrack ? (
        <section className="mb-11 mt-6">
          <HeroCard
            title={featuredTrack.title}
            subtitle={featuredTrack.artist}
            description={`${featured?.title ?? 'Featured'} — the pick we're playing on repeat.`}
            image={featuredTrack.image}
            bgColor={featuredTrack.bgColor}
            isPlaying={isThisPlaying(featuredTrack)}
            onPlay={() => play(featured.tracks, featuredTrack)}
          />
        </section>
      ) : null}

      {/* Newest songs as dense rows — grid columns, not a carousel */}
      {bestNew ? (
        <section className="mb-10">
          <SectionHeading title={bestNew.title} subtitle="Just landed" />

          <div className="grid gap-y-1 min-[660px]:grid-cols-2 min-[1320px]:grid-cols-3">
            {(libraryTracks.length > 0 ? libraryTracks : bestNew.tracks).map((track) => (
              <TrackLockup
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() =>
                  play(libraryTracks.length > 0 ? libraryTracks : bestNew.tracks, track)
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {rest.map((shelf) => (
        <Shelf key={shelf.id} title={shelf.title}>
          {shelf.tracks.map((track) =>
            shelf.kind === 'track' ? (
              <TrackLockup
                key={track.id}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(shelf.tracks, track)}
              />
            ) : (
              <SquareLockup
                key={track.id}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(shelf.tracks, track)}
              />
            ),
          )}
        </Shelf>
      ))}

      <footer className="mt-8 border-t border-white/[0.07] py-8">
        <p className="text-[11px] leading-relaxed text-label-tertiary">
          Music sourced from YouTube Music. Playlists and albums are YouTube searches.
        </p>
      </footer>
    </div>
  );
}