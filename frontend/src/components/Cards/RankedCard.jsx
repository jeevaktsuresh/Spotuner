import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';

/**
 * RankedCard — a Trending entry: cover art with the rank painted over it.
 *
 * The number is deliberately small and semi-transparent so it reads as a
 * ranking marker behind the artwork rather than competing with it.
 */
export default function RankedCard({ rank, title, subtitle, image, bgColor = '#18181c', isPlaying = false, onPlay }) {
  return (
    <div className="group relative w-[152px] shrink-0 sm:w-[176px]">
      <div className="relative">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1}
          rounded="rounded-[12px]"
          className="w-full shadow-[0_8px_28px_-10px_rgba(0,0,0,0.8)]"
          imgClassName="art-hover"
          sizes="176px"
        />

        {/* Rank, bottom-left over the artwork */}
        <span className="pointer-events-none absolute bottom-1.5 left-2 select-none text-[38px] font-extrabold leading-none tracking-tighter text-white/25 transition-colors duration-300 group-hover:text-white/45 sm:text-[44px]">
          {String(rank).padStart(2, '0')}
        </span>

        <div className="play-reveal absolute bottom-2 right-2">
          <PlayButton
            isPlaying={isPlaying}
            onClick={onPlay}
            label={`Play ${title}`}
            className="h-9 w-9 rounded-full bg-white/95 text-black shadow-[0_4px_14px_rgba(0,0,0,0.5)] hover:scale-105"
            iconClassName="text-black"
          />
        </div>
      </div>

      <p
        className={`clamp-1 mt-2.5 text-[13px] font-medium leading-tight ${
          isPlaying ? 'text-accent' : 'text-white'
        }`}
      >
        {title}
      </p>
      {subtitle ? (
        <p className="clamp-1 mt-0.5 text-[12px] leading-tight text-label-secondary">{subtitle}</p>
      ) : null}
    </div>
  );
}