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
import ProgressBar from './ProgressBar';

/**
 * NowPlayingPanel — the Now Playing card plus the Queue list.
 *
 * Positioning is deliberately not handled here: `RightPanel` renders this body
 * twice, once in the docked rail at `xl` and up and once inside the sheet below
 * it. It used to exist only inside the docked rail, which is why the queue was
 * completely unreachable on a laptop or a phone — the PlayerBar's queue button
 * had no handler and the panel that held the queue was `hidden` there.
 *
 * Scrolling is not handled here either, for the same reason: the panel's
 * container decides how it scrolls, and this body keeps no scroller of its own.
 * The gap between the two sections lives here rather than on that container,
 * because the container is a plain block scroller now — as a flex column it
 * squashed its children once the queue outgrew the panel.
 *
 * Skipping goes through `PlayerContext`, so this panel and the PlayerBar move the
 * queue by exactly the same code path that auto-advance uses.
 */
export default function NowPlayingPanel({ onDismiss }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
      duration,
    playbackProvider,
    playbackError,
    play,
    pause,
    seek,
    playQueueIndex,
    next,
    previous,
  } = usePlayer();

  const {
    queue,
    currentIndex,
    shuffle,
    toggleShuffle,
    repeat,
    cycleRepeat,
    removeFromQueue,
    clearQueue,
  } = useQueue();

  const { isLiked, toggleLike } = useLibrary();

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  // Everything from the position onwards, including the track now playing. A
  // failed load leaves the position behind on the previous track, so the entry at
  // `currentIndex` is filtered out only when it has no id of its own.
  const upNext = queue.slice(currentIndex).filter((t) => t?.id);

  const repeatLabel =
    repeat === 'track'
      ? 'Repeat one'
      : repeat === 'context'
        ? 'Repeat queue'
        : 'Repeat off';

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Now Playing ===== */}
      <section className="rounded-[16px] border border-white/[0.06] bg-surface-raised p-3.5">
        <div className="mb-3.5 flex items-center justify-between gap-2 px-1">
          <h2 className="text-[15px] font-semibold text-white">Now Playing</h2>

          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close now playing"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

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

            {/* A track can be credited to one provider and served by another, so
                this says which one is actually producing the audio. */}
            {playbackProvider && currentTrack ? (
              <p className="mt-1 text-[10.5px] uppercase tracking-wider text-label-tertiary">
                via {playbackProvider}
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

        {playbackError ? (
          <p
            role="status"
            className="mt-3 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11.5px] leading-snug text-label-secondary"
          >
            <span className="block font-medium text-white">{playbackError.message}</span>
            <span className="mt-0.5 block">{playbackError.hint}</span>
          </p>
        ) : null}

        {/* Seek bar */}
        <div className="mt-4 px-1">
          <ProgressBar
                duration={duration}
            onSeek={seek}
            disabled={!currentTrack || isLoading}
          />
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
            onClick={previous}
            disabled={!currentTrack || currentIndex <= 0}
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
            onClick={next}
            disabled={!currentTrack || currentIndex >= queue.length - 1}
            aria-label="Next"
            className="t-global text-white hover:scale-105 disabled:opacity-40"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>

          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={repeatLabel}
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

      {/* ===== Queue =====
          No `overflow` here. `RightPanel` scrolls the rail and the sheet on their
          own bodies, and this list used to scroll inside them as well, which is
          what left the pointer trapped over the queue with a scrollbar that had
          nowhere to lead. Growing with the panel is also what makes the docked
          rail and the sheet show the same queue at the same length. */}
      <section className="rounded-[16px] border border-white/[0.06] bg-surface-raised p-3.5">
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
          <div className="grid place-items-center py-8 text-center">
            <div>
              <ListVideo size={22} className="mx-auto mb-2.5 text-white/20" />
              <p className="text-[12.5px] text-label-secondary">Nothing queued</p>
              <p className="mt-1 text-[11.5px] text-label-tertiary">
                Play something from a shelf to build a queue
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {upNext.map((track, i) => {
              // The slice already starts at `currentIndex`, so the absolute
              // position is arithmetic. It used to be `queue.indexOf(track)`,
              // which returned the wrong row for any track that appeared twice.
              const absoluteIndex = currentIndex + i;
              const isCurrent = absoluteIndex === currentIndex;

              return (
                <li key={`${track.source ?? 'yt'}-${track.id}-${absoluteIndex}`}>
                  <div
                    className={`group flex items-center gap-3 rounded-[10px] px-2 py-2 t-global ${
                      isCurrent ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playQueueIndex(absoluteIndex)}
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
                        className="tap-reveal touch-target rounded-full p-1 text-label-secondary opacity-0 t-global hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
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
    </div>
  );
}