import Artwork from '../Artwork/Artwork';
import { Play, Pause } from 'lucide-react';

/**
 * WideCard — the "Made For You" card.
 *
 * Wider and shorter than MediaCard, with copy overlaid on a heavy scrim rather
 * than stacked below, matching the reference's playlist strip.
 */
export default function WideCard({ title, subtitle, image, bgColor = '#1c1822', isPlaying = false, onPlay }) {
  return (
    <div className="group relative w-[248px] shrink-0 sm:w-[262px]">
      <div className="relative overflow-hidden rounded-[12px]">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={2.7}
          rounded="rounded-none"
          className="w-full"
          imgClassName="art-hover"
          sizes="262px"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />

        <div className="absolute inset-0 flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="clamp-1 text-[14px] font-semibold leading-tight text-white">{title}</p>
            {subtitle ? (
              <p className="clamp-1 mt-0.5 text-[12px] leading-tight text-white/70">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onPlay}
            aria-label={`Play ${title}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white opacity-0 shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-all duration-200 group-hover:opacity-100 group-focus-within:opacity-100 hover:scale-105"
          >
            {isPlaying ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}