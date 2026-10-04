import { Link } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useArtists from '../../hooks/useArtists';
import { artistSlug } from '../../utils/artists';
import PageShell from '../Layout/PageShell';
import Artwork from '../Artwork/Artwork';
import { Play } from 'lucide-react';

/**
 * Artists — every individual performer in the catalogue.
 *
 * The previous version grouped tracks by the raw `artist` credit string, so a
 * collaboration like "Jakes Bejoy & Vishal Mishra & Aavani Malhar" became one
 * entry with one song, and the same performer appeared separately on every
 * collaboration they were part of. Credits are now split into individual
 * performers and each artist links to their own songs.
 */
export default function Artists() {
  const { artists, loading, error } = useArtists(10);
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  function play(tracks, item) {
    setQueue(tracks);
    playTrack(item);
  }

  function isThisPlaying(item) {
    return isPlaying && currentTrack?.id === item?.id && currentTrack?.source === item?.source;
  }

  return (
    <PageShell
      title="Artists"
      description={loading ? 'Loading artists...' : `${artists.length} artists you're listening to`}
    >
      {loading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square w-full rounded-full bg-white/[0.05]" />
              <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
      ) : error || artists.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-label-secondary">
          No artists found.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {artists.map((artist) => (
            <div key={artist.key} className="group min-w-0">
              <div className="relative">
                <Link
                  to={`/artists/${encodeURIComponent(artistSlug(artist.key))}`}
                  className="block w-full"
                >
                  <Artwork
                    src={artist.image}
                    alt={artist.name}
                    bgColor="#1c1822"
                    ratio={1}
                    rounded="rounded-full"
                    className="w-full"
                    imgClassName="art-hover"
                    sizes="160px"
                  />

                  <p className="clamp-1 mt-3 text-[13px] font-semibold leading-tight text-white group-hover:underline">
                    {artist.name}
                  </p>
                  <p className="text-[11.5px] text-label-secondary">
                    {artist.songCount} song{artist.songCount === 1 ? '' : 's'}
                  </p>
                </Link>

                {/* Play sits outside the Link so the two are not nested controls.
                    `play-reveal` keeps the hover behaviour on pointer devices and
                    makes the control permanent on touch, where a hover-only button
                    would be unreachable. */}
                <button
                  type="button"
                  onClick={() => play(artist.tracks, artist.tracks[0])}
                  aria-label={`${isThisPlaying(artist.tracks[0]) ? 'Pause' : 'Play'} ${artist.name}`}
                  aria-pressed={isThisPlaying(artist.tracks[0])}
                  className="play-reveal touch-target absolute bottom-[26px] right-1.5 grid h-9 w-9 place-items-center rounded-full bg-accent text-white shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <Play
                    size={14}
                    fill="currentColor"
                    className={isThisPlaying(artist.tracks[0]) ? '' : 'ml-0.5'}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}