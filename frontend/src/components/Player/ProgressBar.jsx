export default function ProgressBar({ position, duration, onSeek }) {
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleSeek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    onSeek((x / rect.width) * duration);
  }

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="flex w-full items-center gap-2">
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-label-tertiary">
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
        className="group relative h-3 flex-1 cursor-pointer"
      >
        {/* Track */}
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/12 transition-all duration-200 group-hover:h-[5px]">
          <div
            className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.25)]"
            style={{ width: `${progress}%`, transition: 'width 0.25s linear' }}
          />
        </div>
        {/* Knob */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-opacity duration-200 group-hover:opacity-100"
          style={{ left: `${progress}%`, marginLeft: '-6px' }}
        />
      </div>

      <span className="w-8 shrink-0 text-[10px] tabular-nums text-label-tertiary">
        {formatTime(duration)}
      </span>
    </div>
  );
}
