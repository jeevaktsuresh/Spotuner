import { useMemo } from 'react';
import useShelves from '../../hooks/useShelves';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import PageShell from '../Layout/PageShell';
import SectionHeading from '../Layout/SectionHeading';
import ShelfRow from '../Layout/ShelfRow';
import WideCard from '../Cards/WideCard';

/**
 * Browse — genre-style entry points built from the shelf queries.
 *
 * The backend has no browse endpoint, so this presents the existing shelves as
 * browsable stations rather than inventing a new data source.
 */
export default function Browse() {
  const { shelves, loading, error } = useShelves(10);
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const rows = useMemo(
    () =>
      shelves.map((shelf) => ({
        id: shelf.id,
        title: shelf.title,
        subtitle: `${shelf.tracks?.length ?? 0} tracks`,
        tracks: shelf.tracks ?? [],
      })),
    [shelves],
  );

  function play(items, item) {
    setQueue(items);
    playTrack(item);
  }

  function isThisPlaying(item) {
    return isPlaying && currentTrack?.id === item?.id && currentTrack?.source === item?.source;
  }

  return (
    <PageShell title="Browse" description="Everything in one place, ready to play.">
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[12px] bg-white/[0.05]" />
          ))}
        </div>
      ) : error || rows.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-label-secondary">
          Couldn't load music right now.
        </p>
      ) : (
        rows.map((row) => (
          <section key={row.id} className="mb-9">
            <SectionHeading title={row.title} />
            <ShelfRow>
                {row.tracks.map((track) => (
                  <WideCard
                    key={track.id}
                    title={track.title}
                    subtitle={track.artist}
                    image={track.image}
                    bgColor={track.bgColor}
                    isPlaying={isThisPlaying(track)}
                    onPlay={() => play(row.tracks, track)}
                  />
                ))}
              </ShelfRow>
          </section>
        ))
      )}
    </PageShell>
  );
}