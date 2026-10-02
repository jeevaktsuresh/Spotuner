import Artwork from '../Artwork/Artwork';
import { Play, Pause, Loader2 } from 'lucide-react';

/**
 * QuickCard — the small landscape tile used in the "Good Evening" row.
 *
 * Artwork fills the tile; title and subtitle overlay the lower-left, and a
 * circular play control sits bottom-right, matching the reference layout.
 */
export default function QuickCard({
  title,
  subtitle,
  image,
  bgColor = '#3a1b30',
  isPlaying = false,
  isLoading = false,
  onPlay,
}) {
  return (
    <div className="group relative w-[176px] shrink-0 sm:w-[186px]">
      <div className="relative overflow-hidden rounded-[12px]">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1.62}
          rounded="rounded-none"
          className="w-full"
          imgClassName="art-hover"
          sizes="186px"
        />

        {/* Legibility scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-2.5 pr-11">
          <p className="clamp-1 text-[12.5px] font-semibold leading-tight text-white">{title}</p>
          {subtitle ? (
            <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-white/65">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Play control */}
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${title}`}
          className="absolute bottom-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-black shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-all duration-200 hover:scale-105"
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={13} fill="currentColor" />
          ) : (
            <Play size={13} fill="currentColor" className="ml-px" />
          )}
        </button>
      </div>
    </div>
  );
}