import Artwork from '../Artwork/Artwork';
import { Play, Pause, MoreHorizontal } from 'lucide-react';

/**
 * MediaCard — the "Recently Played" card.
 *
 * Artwork sits above the text rather than behind it: title and artist stack
 * underneath, with a "..." affordance right-aligned on the title line. This is
 * the reference's most-used card, so it stays deliberately plain — no shadow,
 * no border on the artwork.
 *
 * `badge` is an optional one-line note under the subtitle. It exists for the
 * multi-source case, where a card may also exist on another provider, and is
 * omitted entirely when absent so every other card renders exactly as before.
 */
export default function MediaCard({
  title,
  subtitle,
  image,
  bgColor = '#1c1822',
  isPlaying = false,
  onPlay,
  badge = null,
}) {
  return (
    <div className="group w-[176px] shrink-0 sm:w-[186px]">
      <div className="relative overflow-hidden rounded-[10px]">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1.66}
          rounded="rounded-[10px]"
          className="w-full"
          imgClassName="art-hover"
          sizes="186px"
        />

        {/* Play overlay, revealed on hover */}
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${title}`}
          className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition-transform duration-200 group-hover:scale-105">
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </span>
        </button>
      </div>

      <div className="mt-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`clamp-1 text-[12.5px] font-semibold leading-tight ${
              isPlaying ? 'text-accent' : 'text-white'
            }`}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
              {subtitle}
            </p>
          ) : null}
          {badge ? (
            <p className="clamp-1 mt-0.5 text-[10.5px] leading-tight text-white/35">{badge}</p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={`More options for ${title}`}
          className="-mr-1 shrink-0 rounded-full p-1 text-label-secondary opacity-0 t-global hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}