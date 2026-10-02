import { useMemo } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useShelves from '../../hooks/useShelves';
import SectionHeading from '../Layout/SectionHeading';
import Artwork from '../Artwork/Artwork';
import { Play, Pause } from 'lucide-react';

/**
 * Albums — square album grid built from shelf tracks.
 *
 * Mirrors the reference's square artwork treatment. Rows are the shelf
 * groupings, so the page reuses whatever editorial buckets already exist.
 */
export default function Albums() {
  const { shelves, loading, error } = useShelves(10);
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const rows = useMemo(
    () =>
      shelves
        .filter((s) => (s.tracks ?? []).length > 0)
        .map((s) => ({ id: s.id, title: s.title, tracks: s.tracks })),
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
    <div className="px-5 pb-8 pt-6 md:px-7">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
          Albums
        </h1>
        <p className="mt-1.5 text-[13px] text-label-secondary">
          Collections from your library
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square w-full rounded-[10px] bg-white/[0.05]" />
              <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
      ) : error || rows.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-label-secondary">
          No albums found.
        </p>
      ) : (
        rows.map((row) => (
          <section key={row.id} className="mb-9">
            <SectionHeading title={row.title} />

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {row.tracks.map((track) => (
                <div key={track.id} className="group min-w-0">
                  <div className="relative">
                    <Artwork
                      src={track.image}
                      alt={track.title}
                      bgColor={track.bgColor ?? '#1c1822'}
                      ratio={1}
                      rounded="rounded-[10px]"
                      className="w-full"
                      imgClassName="art-hover"
                      sizes="200px"
                    />

                    <button
                      type="button"
                      onClick={() => play(row.tracks, track)}
                      aria-label={`Play ${track.title}`}
                      className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-accent text-white opacity-0 shadow-lg transition-all duration-200 hover:scale-105 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {isThisPlaying(track) ? (
                        <Pause size={15} fill="currentColor" />
                      ) : (
                        <Play size={15} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>

                  <p
                    className={`clamp-1 mt-2.5 text-[13px] font-semibold leading-tight ${
                      isThisPlaying(track) ? 'text-accent' : 'text-white'
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="clamp-1 mt-0.5 text-[11.5px] text-label-secondary">
                    {track.artist}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}