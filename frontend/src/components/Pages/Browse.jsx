import { useMemo } from 'react';
import useShelves from '../../hooks/useShelves';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import SectionHeading from '../Layout/SectionHeading';
import WideCard from '../Cards/WideCard';

function PageShell({ title, description, children }) {
  return (
    <div className="px-5 pb-8 pt-6 md:px-7">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-1.5 text-[13px] text-label-secondary">{description}</p>
      </header>
      {children}
    </div>
  );
}

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
            <div className="shelf-x scrollbar-hide flex gap-4 pb-1">
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
            </div>
          </section>
        ))
      )}
    </PageShell>
  );
}