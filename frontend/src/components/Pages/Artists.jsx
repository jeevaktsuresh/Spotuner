import { Link } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useArtists from '../../hooks/useArtists';
import { artistSlug } from '../../utils/artists';
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
    <div className="px-5 pb-8 pt-6 md:px-7">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
          Artists
        </h1>
        <p className="mt-1.5 text-[13px] text-label-secondary">
          {loading ? 'Loading artists...' : `${artists.length} artists you're listening to`}
        </p>
      </header>

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

                {/* Play sits outside the Link so the two are not nested controls. */}
                <button
                  type="button"
                  onClick={() => play(artist.tracks, artist.tracks[0])}
                  aria-label={`Play ${artist.name}`}
                  className="absolute bottom-[26px] right-1.5 grid h-9 w-9 place-items-center rounded-full bg-accent text-white opacity-0 shadow-lg transition-all duration-200 hover:scale-105 group-hover:opacity-100 group-focus-within:opacity-100"
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
    </div>
  );
}