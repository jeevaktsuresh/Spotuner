import {
  Heart,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Loader2,
  MoreHorizontal,
  X,
  ListVideo,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { useLibrary } from '../../context/LibraryContext';
import Artwork from '../Artwork/Artwork';
import { formatDuration } from '../../utils/formatTime';

/**
 * RightPanel — the Now Playing card plus the Queue list.
 *
 * Docks to the right of the content column on wide screens and collapses to a
 * hidden drawer below `xl`, where the bottom PlayerBar carries the same
 * transport controls.
 */
export default function RightPanel() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    position,
    duration,
    play,
    pause,
    seek,
    playTrack,
  } = usePlayer();

  const {
    queue,
    currentIndex,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    next,
    previous,
    removeFromQueue,
    clearQueue,
  } = useQueue();

  const { isLiked, toggleLike } = useLibrary();

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const upNext = queue.slice(currentIndex).filter((t) => t?.id);
  const liked = currentTrack ? isLiked(currentTrack.id) : false;

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

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col gap-5 overflow-y-auto bg-surface-panel px-4 py-5 xl:flex scrollbar-hide">
      {/* ===== Now Playing ===== */}
      <section className="rounded-[16px] border border-white/[0.06] bg-surface-raised p-3.5">
        <h2 className="mb-3.5 px-1 text-[15px] font-semibold text-white">Now Playing</h2>

        <Artwork
          src={currentTrack?.image}
          alt={currentTrack?.title ?? ''}
          bgColor="#1c1822"
          ratio={1.24}
          rounded="rounded-[12px]"
          className="w-full"
          sizes="310px"
          eager
        />

        {/* Title row */}
        <div className="mt-3.5 flex items-start gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p
              className={`clamp-1 text-[15px] font-semibold leading-tight ${
                currentTrack ? 'text-white' : 'text-label-secondary'
              }`}
            >
              {currentTrack?.title ?? 'Nothing playing'}
            </p>
            {currentTrack?.artist ? (
              <p className="clamp-1 mt-0.5 text-[12.5px] leading-tight text-label-secondary">
                {currentTrack.artist}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => currentTrack && toggleLike(currentTrack)}
            disabled={!currentTrack}
            aria-label={liked ? 'Remove from Library' : 'Add to Library'}
            aria-pressed={liked}
            className="shrink-0 rounded-full p-1.5 t-global hover:bg-white/[0.07] disabled:opacity-30"
          >
            <Heart size={18} className={liked ? 'text-accent' : 'text-label-secondary'} />
          </button>

          <button
            type="button"
            aria-label="More options"
            className="shrink-0 rounded-full p-1.5 t-global hover:bg-white/[0.07]"
          >
            <MoreHorizontal size={18} className="text-label-secondary" />
          </button>
        </div>

        {/* Seek bar */}
        <div className="mt-4 px-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={Math.floor(position || 0)}
            onClick={handleSeek}
            className="group relative h-4 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-label-secondary">
            <span>{formatDuration(position)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Transport */}
        <div className="mt-4 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label="Shuffle"
            aria-pressed={shuffle}
            className={`t-global ${shuffle ? 'text-accent' : 'text-label-secondary hover:text-white'}`}
          >
            <Shuffle size={17} />
          </button>

          <button
            type="button"
            onClick={handlePrevious}
            disabled={!currentTrack}
            aria-label="Previous"
            className="t-global text-white hover:scale-105 disabled:opacity-40"
          >
            <SkipBack size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={isPlaying ? pause : play}
            disabled={!currentTrack || isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="grid h-14 w-14 place-items-center rounded-full bg-accent text-white transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!currentTrack}
            aria-label="Next"
            className="t-global text-white hover:scale-105 disabled:opacity-40"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={`relative t-global ${
              repeat !== 'off' ? 'text-accent' : 'text-label-secondary hover:text-white'
            }`}
          >
            <Repeat size={17} />
            {repeat === 'track' ? (
              <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
            ) : null}
          </button>
        </div>
      </section>

      {/* ===== Queue ===== */}
      <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-white/[0.06] bg-surface-raised p-3.5">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold text-white">Queue</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearQueue}
              disabled={upNext.length === 0}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-medium text-label-secondary t-global hover:bg-white/[0.07] hover:text-white disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </div>

        {upNext.length === 0 ? (
          <div className="grid flex-1 place-items-center py-8 text-center">
            <div>
              <ListVideo size={22} className="mx-auto mb-2.5 text-white/20" />
              <p className="text-[12.5px] text-label-secondary">Nothing queued</p>
            </div>
          </div>
        ) : (
          <ul className="scrollbar-hide -mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {upNext.map((track) => {
              const absoluteIndex = queue.indexOf(track);
              const isCurrent = absoluteIndex === currentIndex;

              return (
                <li key={`${track.id}-${absoluteIndex}`}>
                  <div
                    className={`group flex items-center gap-3 rounded-[10px] px-2 py-2 t-global ${
                      isCurrent ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(track)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Artwork
                        src={track.image}
                        alt={track.title}
                        bgColor={track.bgColor ?? '#1c1822'}
                        ratio={1}
                        rounded="rounded-[8px]"
                        className="h-10 w-10 shrink-0"
                        sizes="40px"
                      />

                      <div className="min-w-0 flex-1">
                        <p
                          className={`clamp-1 text-[12.5px] font-medium leading-tight ${
                            isCurrent ? 'text-accent' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
                          {track.artist}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {/* Playing indicator on the active row */}
                      {isCurrent && isPlaying ? (
                        <span className="flex h-4 w-4 items-end gap-[2px]" aria-label="Playing">
                          {[10, 16, 8].map((h, bar) => (
                            <span
                              key={bar}
                              className="w-[2.5px] animate-pulse rounded-full bg-accent"
                              style={{ height: `${h}px` }}
                            />
                          ))}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => removeFromQueue(absoluteIndex)}
                        aria-label={`Remove ${track.title} from queue`}
                        className="rounded-full p-1 text-label-secondary opacity-0 t-global hover:text-white group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>

                      <button
                        type="button"
                        aria-label={`More options for ${track.title}`}
                        className="rounded-full p-1 text-label-secondary t-global hover:text-white"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}