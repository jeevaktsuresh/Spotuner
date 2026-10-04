import { useCallback } from 'react';
import { formatTime } from '../../utils/formatTime';
import { usePlayerProgress } from '../../context/PlayerContext';

/** Keyboard step, in seconds. Large enough to cross a verse, small enough to land on a line. */
const STEP = 5;

/**
 * ProgressBar — the seek control shared by the PlayerBar and the Now Playing panel.
 *
 * One implementation, so the two places that show playback progress cannot drift
 * apart in track height, label size or behaviour. Previously each inlined its own
 * copy, and this file was not used at all.
 *
 * Click to seek, or focus it and use the arrow keys, Home and End — it advertises
 * `role="slider"` and is focusable, so it has to actually respond to a keyboard.
 *
 * The position is read from `usePlayerProgress` rather than passed in. It updates
 * ten times a second, and taking it as a prop put that rate on whoever rendered
 * this: the PlayerBar and the whole Now Playing queue list. Reading it here
 * scopes the per-tick re-render to the two scrubbers that actually display it.
 */
export default function ProgressBar({
  duration,
  onSeek,
  /** Set while the track is still resolving, which makes seeking a no-op. */
  disabled = false,
  className = '',
}) {
  const position = usePlayerProgress();

  const handleSeek = useCallback((e) => {
    if (disabled || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onSeek((x / rect.width) * duration);
  }, [disabled, duration, onSeek]);

  // `position` is deliberately not a dependency. It changes ten times a second,
  // and including it would rebuild this handler on every tick to no purpose.
  const handleKeyDown = useCallback(
    (e) => {
      if (disabled || !duration) return;

      let target = null;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          target = position + STEP;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          target = position - STEP;
          break;
        case 'PageUp':
          target = position + STEP * 4;
          break;
        case 'PageDown':
          target = position - STEP * 4;
          break;
        case 'Home':
          target = 0;
          break;
        case 'End':
          target = duration;
          break;
        default:
          return;
      }

      e.preventDefault();
      onSeek(Math.max(0, Math.min(target, duration)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, duration, onSeek]
  );

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      {/* Hidden on the narrowest screens so the track itself keeps the room. */}
      <span className="hidden w-9 shrink-0 text-right text-[10.5px] tabular-nums text-label-secondary sm:block">
        {formatTime(position)}
      </span>

      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={Math.floor(position || 0)}
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        aria-disabled={disabled || undefined}
        onClick={handleSeek}
        onKeyDown={handleKeyDown}
        className="group relative h-4 min-w-0 flex-1 cursor-pointer focus-visible:outline-none"
      >
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/12 transition-all duration-200 group-hover:h-[5px] group-focus-visible:h-[5px]">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress}%`, transition: 'width 0.2s linear' }}
          />
        </div>
        {/* Knob */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ left: `${progress}%`, marginLeft: '-6px' }}
        />
      </div>

      <span className="hidden w-9 shrink-0 text-[10.5px] tabular-nums text-label-secondary sm:block">
        {formatTime(duration)}
      </span>
    </div>
  );
}