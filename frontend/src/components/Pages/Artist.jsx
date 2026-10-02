import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Pause, Play } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useArtists from '../../hooks/useArtists';
import Artwork from '../Artwork/Artwork';
import TrackRow from '../Cards/TrackRow';

/** Stable empty list so `songs` keeps one identity while an artist is unknown. */
const EMPTY = [];

/**
 * Artist — the songs credited to one performer.
 *
 * Reached from the Artists grid, and also directly addressable by URL, so the
 * rollup is shared through `useArtists` rather than recomputed per page: an
 * artist opened from the list and one opened from a link must show the same
 * song count.
 */
export default function Artist() {
  const { artistKey } = useParams();
  const { findArtist, loading } = useArtists(10);
  const { currentTrack, isPlaying, playTrack, pause } = usePlayer();
  const { setQueue } = useQueue();

  const artist = findArtist(artistKey);

  // A collaboration is credited to several artists, so the song list shows the
  // full original credit rather than repeating this artist's name on every row.
  const songs = artist?.tracks ?? EMPTY;

  const isArtistPlaying = isPlaying && songs.some((t) => t.id === currentTrack?.id);

  if (loading) {
    return (
      <div className="px-5 pb-8 pt-6 md:px-7">
        <div className="h-[200px] w-full animate-pulse rounded-[16px] bg-white/[0.05]" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="px-5 py-16 text-center md:px-7">
        <p className="text-[14px] font-medium text-white">Artist not found</p>
        <p className="mt-1.5 text-[12.5px] text-label-secondary">
          We don't have any songs credited to this artist yet.
        </p>
        <Link
          to="/artists"
          className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover"
        >
          Back to Artists
        </Link>
      </div>
    );
  }

  function playAll() {
    if (songs.length === 0) return;
    if (isArtistPlaying) {
      pause();
      return;
    }
    setQueue(songs);
    playTrack(songs[0]);
  }

  function isThisPlaying(track) {
    return isPlaying && currentTrack?.id === track.id && currentTrack?.source === track.source;
  }

  return (
    <div className="pb-8">
      {/* ===== Hero header ===== */}
      <div className="relative">
        <div
          className="absolute inset-0 -z-10 blur-3xl"
          style={{
            background: `radial-gradient(60% 60% at 20% 20%, ${
              artist.bgColor ?? 'rgba(231,90,158,0.22)'
            }, transparent 70%)`,
          }}
        />

        <div className="px-5 pb-8 pt-5 md:px-7">
          <Link
            to="/artists"
            className="mb-6 inline-flex items-center gap-1 text-[12.5px] text-label-secondary transition-colors duration-200 hover:text-white"
          >
            <ChevronLeft size={15} />
            All Artists
          </Link>

          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-end">
            <Artwork
              src={artist.image}
              alt={artist.name}
              bgColor="#1c1822"
              ratio={1}
              rounded="rounded-full"
              className="h-[140px] w-[140px] shrink-0 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.9)] sm:h-[176px] sm:w-[176px]"
              sizes="176px"
            />

            <div className="min-w-0">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-accent">
                Artist
              </p>
              <h1 className="mt-1.5 break-words text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[38px]">
                {artist.name}
              </h1>
              <p className="mt-1 text-[12.5px] text-label-secondary">
                {artist.songCount} song{artist.songCount === 1 ? '' : 's'}
              </p>

              <button
                type="button"
                onClick={playAll}
                disabled={songs.length === 0}
                aria-label={isArtistPlaying ? `Pause ${artist.name}` : `Play ${artist.name}`}
                className="mt-5 grid h-11 w-11 place-items-center rounded-full bg-accent text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {isArtistPlaying ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" className="ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Songs ===== */}
      <section className="px-5 md:px-7">
        <h2 className="mb-3 text-[15px] font-semibold text-white">Songs</h2>

        {songs.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-label-secondary">
            No songs available for this artist.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {songs.map((track, index) => (
              <TrackRow
                key={`${track.source ?? 'yt'}-${track.id}`}
                track={track}
                index={index}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play([track], track)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}