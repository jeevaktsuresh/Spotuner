import { useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function VolumeControl({ volume, onChange }) {
  const trackRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  function handleClick(e) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onChange(x / rect.width);
  }

  function toggleMute() {
    onChange(volume > 0 ? 0 : 0.7);
  }

  return (
    <div className="group flex items-center gap-2">
      <button
        type="button"
        onClick={toggleMute}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white"
      >
        {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(volume * 100)}
        onClick={handleClick}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="relative hidden h-3 w-24 cursor-pointer sm:block"
      >
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/12 transition-all duration-200 group-hover:h-[5px]">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${volume * 100}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white transition-opacity"
          style={{ left: `${volume * 100}%`, marginLeft: '-6px', opacity: hovering ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
