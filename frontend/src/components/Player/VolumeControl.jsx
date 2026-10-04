import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/** Keyboard step, as a fraction of full volume. */
const STEP = 0.05;

/**
 * VolumeControl — the mute button and level slider shared by the player chrome.
 *
 * Reused rather than reimplemented: the PlayerBar had its own copy of this
 * control inline, with a different reveal behaviour, and this file was unused.
 *
 * The slider is `role="slider"` and focusable, so it handles the keyboard too.
 */
export default function VolumeControl({ volume, onChange, className = '' }) {
  const trackRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  function handleClick(e) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onChange(x / rect.width);
  }

  function handleKeyDown(e) {
    let target = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        target = volume + STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        target = volume - STEP;
        break;
      case 'PageUp':
        target = volume + STEP * 4;
        break;
      case 'PageDown':
        target = volume - STEP * 4;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(Math.max(0, Math.min(target, 1)));
  }

  function toggleMute() {
    onChange(volume > 0 ? 0 : 0.7);
  }

  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
        aria-pressed={volume === 0}
        className="shrink-0 rounded-full p-1.5 text-label-secondary t-global hover:bg-white/[0.07] hover:text-white"
      >
        {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      {/* Below `sm` there is no room for a level control next to the transport. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        aria-valuetext={volume === 0 ? 'Muted' : `${Math.round(volume * 100)}%`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="relative hidden h-3 w-[92px] shrink-0 cursor-pointer focus-visible:outline-none sm:block"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/12 transition-all duration-200 group-hover:h-[5px] group-focus-visible:h-[5px]">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${volume * 100}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-opacity"
          style={{ left: `${volume * 100}%`, marginLeft: '-6px', opacity: hovering ? 1 : 0 }}
        />
      </div>
    </div>
  );
}