import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';

/**
 * QuickPick — the small landscape card used in the Quick Picks row.
 *
 * Artwork fills the card and the text overlays it, so a row of these reads as
 * a strip of tiles rather than a grid of thumbnails.
 */
export default function QuickPick({
  title,
  subtitle,
  image,
  bgColor = '#18181c',
  isPlaying = false,
  onPlay,
}) {
  return (
    <div className="group relative w-[168px] shrink-0 sm:w-[200px]">
      <div className="glow-hover relative overflow-hidden rounded-[10px] border border-white/[0.06] bg-surface-2">
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1.28}
          rounded="rounded-none"
          className="w-full"
          imgClassName="art-hover"
          sizes="200px"
        />

        {/* Scrim keeps the overlaid title legible on bright artwork */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="clamp-1 text-[12px] font-semibold leading-tight text-white">{title}</p>
          {subtitle ? (
            <p className="clamp-1 mt-0.5 text-[11px] leading-tight text-white/60">{subtitle}</p>
          ) : null}
        </div>

        <div className="play-reveal absolute bottom-2.5 right-2.5">
          <PlayButton
            isPlaying={isPlaying}
            onClick={onPlay}
            label={`Play ${title}`}
            className="h-8 w-8 rounded-full bg-white/95 text-black shadow-[0_4px_14px_rgba(0,0,0,0.45)] hover:scale-105"
            iconClassName="text-black"
          />
        </div>
      </div>
    </div>
  );
}