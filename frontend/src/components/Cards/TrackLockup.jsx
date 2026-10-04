import { Play, Pause } from 'lucide-react';
import Artwork from '../Artwork/Artwork';

/**
 * TrackLockup — the dense horizontal song row used by shelves.
 *
 * 44px artwork on the left, title + artist on the right, play glyph overlaid on
 * the artwork.
 *
 * As with `TrackRow`, the row is the control: a `<button>` rather than a `<div>`
 * with a hover-only overlay, so the whole row is tappable on a phone and
 * reachable by keyboard. That forbids a nested button, so the glyph is
 * decorative — hover-revealed on pointer devices, permanent on touch.
 */
export default function TrackLockup({
  title,
  subtitle,
  image,
  bgColor = '#1c1822',
  isPlaying = false,
  onPlay,
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}`}
      className="tap-row group relative flex w-full min-w-0 items-center gap-3 rounded-[10px] py-1.5 pl-2.5 pr-2 text-left no-drag t-global hover:bg-white/[0.06] focus-visible:bg-white/[0.06]"
    >
      {/* Accent rail marking the playing row, as in TrackRow. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent transition-opacity duration-200 ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <span className="relative shrink-0">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1}
          rounded="rounded-[8px]"
          className="h-11 w-11"
          sizes="44px"
        />
        <span className="play-reveal art-scrim absolute inset-0 grid place-items-center rounded-[8px] bg-black/55">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white">
            {isPlaying ? (
              <Pause size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" className="ml-0.5" />
            )}
          </span>
        </span>
      </span>

      {/* No `block` alongside `clamp-1` — the utility would override its display and
          silently drop the line clamp. */}
      <span className="min-w-0 flex-1">
        <span
          className={`clamp-1 text-[12.5px] leading-tight ${
            isPlaying ? 'font-semibold text-accent' : 'font-medium text-white'
          }`}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}