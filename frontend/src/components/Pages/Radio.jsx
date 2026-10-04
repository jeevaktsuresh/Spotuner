import { useMemo } from 'react';
import { Radio as RadioIcon } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useShelves from '../../hooks/useShelves';
import PageShell from '../Layout/PageShell';
import Shelf from '../Layout/Shelf';
import SectionHeading from '../Layout/SectionHeading';
import SquareLockup from '../Cards/SquareLockup';
import TrackLockup from '../Cards/TrackLockup';

/**
 * Radio — station-style listening built from the same shelf data.
 *
 * The backend has no dedicated station endpoint, so this composes stations from
 * the existing shelf queries. Playback is identical to everywhere else.
 */
// Station ids are fixed, so they live at module scope: declaring them inside
// the component would allocate a new array each render and make them an
// unstable effect dependency.
const STATION_IDS = [
  'on-tour',
  'dj-mixes',
  'city-charts',
  'everyones-listening',
  'trending',
];

export default function Radio() {
  const { shelves, loading, error } = useShelves(8);
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const stations = useMemo(
    () => STATION_IDS.map((id) => shelves.find((s) => s.id === id)).filter(Boolean),
    [shelves],
  );

  const songs = useMemo(
    () => shelves.flatMap((shelf) => shelf.tracks ?? []),
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
    <PageShell title="Radio" description="Non-stop stations tuned to your taste.">
      {loading ? (
        <div className="h-7 w-40 animate-pulse rounded bg-white/5" />
      ) : error || shelves.length === 0 ? (
        <div className="py-24 text-center">
          <RadioIcon size={30} className="mx-auto mb-4 text-white/20" />
          <p className="text-[14px] font-medium text-white/85">Couldn't load stations right now</p>
          <p className="mt-1.5 text-[13px] text-label-secondary">
            The backend needs to be running on port 3001.
          </p>
        </div>
      ) : (
        <>
          {stations.map((station) => (
            <Shelf key={station.id} title={station.title}>
              {station.tracks.slice(0, 10).map((track) => (
                <SquareLockup
                  key={track.id}
                  title={track.title}
                  subtitle={track.artist}
                  image={track.image}
                  bgColor={track.bgColor}
                  isPlaying={isThisPlaying(track)}
                  onPlay={() => play(station.tracks, track)}
                />
              ))}
            </Shelf>
          ))}

          {songs.length > 0 ? (
            <section className="mt-8">
              <SectionHeading title="On Air Now" />
              <div className="grid gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                {songs.slice(0, 12).map((track) => (
                  <TrackLockup
                    key={`${track.source ?? 'yt'}-${track.id}`}
                    title={track.title}
                    subtitle={track.artist}
                    image={track.image}
                    bgColor={track.bgColor}
                    isPlaying={isThisPlaying(track)}
                    onPlay={() => play(songs, track)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}