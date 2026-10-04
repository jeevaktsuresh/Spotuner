import { Play, Pause, Loader2 } from 'lucide-react';

/**
 * Apple Music play button.
 * variant="platter"  -> large circular overlay for editorial/hero cards
 * variant="standard" -> small glyph used on track lockups
 *
 * `touch-target` is on both variants: callers size the glyph for a mouse at
 * 28-36px, which is too small to hit accurately with a finger, and the utility
 * raises it to 40px only on devices that cannot hover. Pointer devices are
 * untouched.
 */
export default function PlayButton({
  variant = 'standard',
  isPlaying = false,
  isLoading = false,
  onClick,
  label = 'Play',
  className = '',
  iconClassName = '',
}) {
  if (variant === 'platter') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`touch-target flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-transform duration-150 hover:scale-105 active:scale-95 ${className}`}
      >
        {isLoading ? (
          <Loader2 size={20} className={`animate-spin ${iconClassName}`} />
        ) : isPlaying ? (
          <Pause size={18} fill="currentColor" className={iconClassName} />
        ) : (
          <Play size={18} fill="currentColor" className={`ml-0.5 ${iconClassName}`} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isPlaying}
      className={`touch-target flex items-center justify-center t-global ${className}`}
    >
      {isLoading ? (
        <Loader2 size={16} className={`animate-spin ${iconClassName}`} />
      ) : isPlaying ? (
        <Pause size={16} fill="currentColor" className={iconClassName} />
      ) : (
        <Play size={16} fill="currentColor" className={`ml-0.5 ${iconClassName}`} />
      )}
    </button>
  );
}
