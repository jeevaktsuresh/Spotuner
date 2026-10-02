import {
  Heart,
  MoreHorizontal,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Loader2,
  ListMusic,
  Volume2,
  VolumeX,
  Maximize2,
} from 'lucide-react';
import { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { useLibrary } from '../../context/LibraryContext';
import Artwork from '../Artwork/Artwork';

/**
 * PlayerBar — the fixed bottom transport (~72px, full width).
 *
 * Left: now playing. Centre: shuffle/prev/play/next/repeat over the seek bar.
 * Right: queue, volume (with slider), and fullscreen. Playback comes entirely
 * from the existing contexts; this only renders it.
 */
export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    position,
    duration,
    play,
    pause,
    seek,
    changeVolume,
    playTrack,
  } = usePlayer();

  const { previous, next, shuffle, toggleShuffle, repeat, cycleRepeat, queue } =
    useQueue();

  const { isLiked, toggleLike } = useLibrary();
  const [volumeOpen, setVolumeOpen] = useState(false);

  const liked = currentTrack ? isLiked(currentTrack.id) : false;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  function handleNext() {
    const i = next();
    if (queue[i]) playTrack(queue[i]);
  }

  function handlePrevious() {
    const i = previous();
    if (queue[i]) playTrack(queue[i]);
  }

  function handleSeek(e) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    seek((x / rect.width) * duration);
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="chrome-blur hairline-t relative z-[9901] flex h-[72px] shrink-0 items-center gap-4 px-4">
      {/* LEFT — now playing */}
      <div className="flex min-w-0 items-center gap-3 md:w-[280px] md:shrink-0">
        {currentTrack ? (
          <>
            <Artwork
              src={currentTrack.image}
              alt={currentTrack.title}
              bgColor="#1c1822"
              ratio={1}
              rounded="rounded-[8px]"
              className="h-[52px] w-[52px] shrink-0"
              sizes="52px"
            />

            <div className="min-w-0 flex-1">
              <p className="clamp-1 text-[12.5px] font-semibold leading-tight text-white">
                {currentTrack.title}
              </p>
              {currentTrack.artist ? (
                <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
                  {currentTrack.artist}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => toggleLike(currentTrack)}
              aria-label={liked ? 'Remove from Library' : 'Add to Library'}
              aria-pressed={liked}
              className="shrink-0 rounded-full p-1 t-global hover:bg-white/[0.07]"
            >
              <Heart size={17} className={liked ? 'text-accent' : 'text-label-secondary'} />
            </button>

            <button
              type="button"
              aria-label="More options"
              className="hidden shrink-0 rounded-full p-1 t-global hover:bg-white/[0.07] sm:block"
            >
              <MoreHorizontal size={17} className="text-label-secondary" />
            </button>
          </>
        ) : (
          <p className="text-[12.5px] text-label-secondary">Not Playing</p>
        )}
      </div>

      {/* CENTRE — transport + seek */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={`hidden t-global sm:block ${shuffle ? 'text-accent' : 'text-label-secondary hover:text-white'}`}
          >
            <Shuffle size={16} />
          </button>

          <button
            type="button"
            onClick={handlePrevious}
            disabled={!currentTrack}
            aria-label="Previous"
            className="t-global text-white hover:scale-105 disabled:opacity-40"
          >
            <SkipBack size={19} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={isPlaying ? pause : play}
            disabled={!currentTrack || isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!currentTrack}
            aria-label="Next"
            className="t-global text-white hover:scale-105 disabled:opacity-40"
          >
            <SkipForward size={19} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={`relative hidden t-global sm:block ${
              repeat !== 'off' ? 'text-accent' : 'text-label-secondary hover:text-white'
            }`}
          >
            <Repeat size={16} />
            {repeat === 'track' ? (
              <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
            ) : null}
          </button>
        </div>

        {/* Seek */}
        <div className="flex w-full max-w-[560px] items-center gap-2.5">
          <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums text-label-secondary">
            {formatTime(position)}
          </span>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={Math.floor(position || 0)}
            onClick={handleSeek}
            className="group relative h-4 flex-1 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-opacity duration-200 group-hover:opacity-100"
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          </div>

          <span className="w-9 shrink-0 text-[10.5px] tabular-nums text-label-secondary">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* RIGHT — queue + volume */}
      <div className="flex shrink-0 items-center justify-end gap-3 md:w-[280px]">
        <button
          type="button"
          aria-label="Queue"
          className="rounded-full p-1.5 t-global text-label-secondary hover:bg-white/[0.07] hover:text-white"
        >
          <ListMusic size={17} />
        </button>

        {/* Volume: icon toggles the slider open on hover/click */}
        <div className="group flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeVolume(volume > 0 ? 0 : 0.7)}
            onMouseEnter={() => setVolumeOpen(true)}
            onMouseLeave={() => setVolumeOpen(false)}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            className="rounded-full p-1.5 t-global text-label-secondary hover:text-white"
          >
            {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <div
            className={`hidden h-3 items-center sm:flex ${volumeOpen ? 'w-[92px]' : 'w-0 overflow-hidden'}`}
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                changeVolume(Math.max(0, Math.min(e.clientX - rect.left, rect.width)) / rect.width);
              }}
              className="relative h-3 w-full cursor-pointer"
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Now playing"
          className="hidden rounded-full p-1.5 t-global text-label-secondary hover:text-white lg:block"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}