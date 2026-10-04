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
  Maximize2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { useLibrary } from '../../context/LibraryContext';
import Artwork from '../Artwork/Artwork';
import ProgressBar from './ProgressBar';
import VolumeControl from './VolumeControl';

/**
 * PlayerBar — the docked bottom transport.
 *
 * Left: now playing. Centre: shuffle/prev/play/next/repeat over the seek bar.
 * Right: queue, volume (with slider), and fullscreen. Playback comes entirely
 * from the existing contexts; this only renders it.
 *
 * Skipping goes through `PlayerContext`, which is also the path auto-advance
 * takes, so a skip from here cannot diverge from a skip because a track ended.
 *
 * ## Placement
 *
 * In normal flow beneath `main`, not fixed over it, so it cannot cover page
 * content at any height and cannot be covered by the mobile navigation bar
 * below it. Its height is `--chrome-player`, shared with the bottom nav's
 * `--chrome-nav` and read by the playback-error toast below, which is the one
 * thing here that has to sit clear of both bars.
 *
 * @param {Function} onOpenQueue  opens NowPlayingPanel; the sheet below `xl`
 */
export default function PlayerBar({ onOpenQueue }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    volume,
    position,
    duration,
    playbackProvider,
    playbackError,
    dismissPlaybackError,
    play,
    pause,
    seek,
    changeVolume,
    next,
    previous,
  } = usePlayer();

  const { shuffle, toggleShuffle, repeat, cycleRepeat, queue, currentIndex } = useQueue();

  const { isLiked, toggleLike } = useLibrary();

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  // Disabled at the edges of the queue rather than silently replaying whatever
  // happens to sit at `currentIndex`.
  const canSkipBack = Boolean(currentTrack) && currentIndex > 0;
  const canSkipForward =
    Boolean(currentTrack) && currentIndex < queue.length - 1;

  const repeatLabel =
    repeat === 'track'
      ? 'Repeat one'
      : repeat === 'context'
        ? 'Repeat queue'
        : 'Repeat off';

  return (
    <>
      {/*
        Playback failures, surfaced where they happen.

        Previously a failed load was only written to the console, so an
        unplayable track was indistinguishable from a finished one.
      */}
      {playbackError ? (
        <div
          role="alert"
          // Anchored to the bottom chrome rather than to a hard-coded offset, so
          // it stays above the transport when the bar changes height and above
          // the navigation bar wherever that bar exists. Before this it sat at
          // `bottom-[84px]`, which assumed a 72px player and no nav beneath it,
          // and on a phone it rendered on top of the tabs.
          className="fixed left-1/2 z-[9910] w-[calc(100vw-2*var(--gutter))] max-w-md -translate-x-1/2 rounded-[12px] border border-white/[0.1] bg-surface-raised px-4 py-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)]"
          style={{
            bottom: 'calc(var(--chrome-player) + var(--chrome-nav) + env(safe-area-inset-bottom) + 12px)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0 text-accent"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-tight text-white">
                {playbackError.message}
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-label-secondary">
                {playbackError.hint}
              </p>
            </div>

            <button
              type="button"
              onClick={dismissPlaybackError}
              aria-label="Dismiss playback error"
              className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-label-secondary t-global hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="chrome-blur hairline-t relative z-[9901] flex h-[var(--chrome-player)] shrink-0 items-center gap-3 px-[var(--gutter)] sm:gap-4">
        {/* LEFT — now playing.
            No width cap below `md`, deliberately. This block has a content-based
            flex basis and shrinks at `min-w-0`, while the transport column has a
            zero basis, so flexbox already routes every pixel of pressure to the
            title and the controls keep their width. A max-width here would do the
            opposite: it would let a long title claim space the transport needs
            and push the controls off the bar. */}
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
                {/* The track's own provider and the one serving the audio are not
                    always the same, and the difference is worth showing. */}
                {playbackProvider ? (
                  <p className="clamp-1 mt-0.5 text-[10px] uppercase tracking-wider text-label-tertiary">
                    via {playbackProvider}
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
          <div className="flex items-center gap-4 sm:gap-5">
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
              onClick={previous}
              disabled={!canSkipBack}
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
              onClick={next}
              disabled={!canSkipForward}
              aria-label="Next"
              className="t-global text-white hover:scale-105 disabled:opacity-40"
            >
              <SkipForward size={19} fill="currentColor" />
            </button>

            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={repeatLabel}
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
          <div className="w-full max-w-[560px]">
            <ProgressBar
              position={position}
              duration={duration}
              onSeek={seek}
              disabled={!currentTrack || isLoading}
            />
          </div>
        </div>

        {/* RIGHT — queue + volume */}
        <div className="flex shrink-0 items-center justify-end gap-3 md:w-[280px]">
          {/* Opens the docked rail on wide screens and the sheet below it, so the
              queue is reachable everywhere. */}
          <button
            type="button"
            onClick={onOpenQueue}
            aria-label="Queue"
            className="rounded-full p-1.5 t-global text-label-secondary hover:bg-white/[0.07] hover:text-white"
          >
            <ListMusic size={17} />
          </button>

          <VolumeControl volume={volume} onChange={changeVolume} />

          <button
            type="button"
            onClick={onOpenQueue}
            aria-label="Now playing"
            className="hidden rounded-full p-1.5 t-global text-label-secondary hover:bg-white/[0.07] hover:text-white lg:block"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </>
  );
}