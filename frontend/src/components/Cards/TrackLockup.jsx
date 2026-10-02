import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';

/**
 * TrackLockup — the dense horizontal song row used by shelves.
 *
 * 48px artwork on the left, title + artist on the right, play glyph overlaid
 * on the artwork on hover.
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
    <div className="group flex min-w-0 items-center gap-3 rounded-[10px] py-1.5 pr-2 no-drag t-global hover:bg-white/[0.06]">
      <div className="relative shrink-0">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1}
          rounded="rounded-[8px]"
          className="h-11 w-11"
          sizes="44px"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-black/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <PlayButton
            isPlaying={isPlaying}
            onClick={onPlay}
            label={`Play ${title}`}
            className="h-7 w-7 rounded-full bg-accent text-white hover:scale-105"
            iconClassName="text-white"
          />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`clamp-1 text-[12.5px] leading-tight ${
            isPlaying ? 'font-semibold text-accent' : 'font-medium text-white'
          }`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}