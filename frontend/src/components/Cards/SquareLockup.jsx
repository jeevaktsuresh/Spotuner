import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';

/**
 * SquareLockup — the square album card used by New Releases and shelves.
 *
 * Fixed-width so it can live in a horizontal carousel without stretching; the
 * square ratio plus `object-cover` keeps artwork from distorting at any size.
 */
export default function SquareLockup({
  title,
  subtitle,
  image,
  bgColor = '#1c1822',
  isPlaying = false,
  onPlay,
  badge = null,
  // Fixed width suits a horizontal carousel; `fluid` fills its grid cell.
  fluid = false,
}) {
  return (
    <div className={`group no-drag ${fluid ? 'w-full' : 'w-[160px] shrink-0 sm:w-[184px]'}`}>
      <div className="relative">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1}
          rounded="rounded-[10px]"
          className="w-full"
          imgClassName="art-hover"
          sizes="184px"
        />

        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            {badge}
          </span>
        ) : null}

        <div className="play-reveal absolute bottom-2.5 right-2.5">
          <PlayButton
            isPlaying={isPlaying}
            onClick={onPlay}
            label={`Play ${title}`}
            className="h-9 w-9 rounded-full bg-accent text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)] hover:scale-105"
            iconClassName="text-white"
          />
        </div>
      </div>

      <p
        className={`clamp-1 mt-2.5 text-[13px] font-semibold leading-tight ${
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
    </div>
  );
}