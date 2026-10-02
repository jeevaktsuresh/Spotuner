import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';
import { Plus } from 'lucide-react';

/**
 * HeroCard — the cinematic Featured banner.
 *
 * Square cover on the left, copy + actions on the right. The purple/black wash
 * sits over the whole card so the artwork reads as ambient colour rather than a
 * photo, which keeps the text legible at every viewport width.
 */
export default function HeroCard({
  title,
  subtitle,
  description,
  image,
  bgColor = '#18181c',
  isPlaying = false,
  onPlay,
  onAdd,
}) {
  return (
    <div className="group relative overflow-hidden rounded-[16px] border border-white/[0.07] bg-surface-raised glow-hover">
      {/* Ambient artwork bleed */}
      <Artwork
        src={image}
        alt={title}
        bgColor={bgColor}
        className="absolute inset-0 h-full w-full"
        imgClassName="scale-105 opacity-30 blur-[2px] transition-transform duration-700 group-hover:scale-110"
        rounded="rounded-none"
      />

      {/* Purple-to-black wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(5,5,5,0.96) 0%, rgba(13,8,24,0.88) 44%, rgba(24,10,38,0.62) 100%)',
        }}
      />

      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center md:gap-7 md:p-7">
        {/* Cover */}
        <Artwork
          src={image}
          alt={title}
          bgColor={bgColor}
          ratio={1}
          rounded="rounded-[12px]"
          className="h-[132px] w-[132px] shrink-0 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/10 md:h-[184px] md:w-[184px]"
          sizes="184px"
          eager
        />

        {/* Copy + actions */}
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
            Featured
          </p>

          <h2 className="clamp-2 text-[24px] font-bold leading-[1.12] tracking-tight text-white md:text-[32px]">
            {title}
          </h2>

          {subtitle ? (
            <p className="clamp-1 mt-1.5 text-[14px] font-medium text-white/75">{subtitle}</p>
          ) : null}

          {description ? (
            <p className="clamp-2 mt-2 max-w-[46ch] text-[13px] leading-relaxed text-white/50">
              {description}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onPlay}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition-transform duration-200 hover:scale-[1.03] active:scale-95"
            >
              <PlayButton
                isPlaying={isPlaying}
                onClick={null}
                label=""
                iconClassName="text-black"
              />
              {isPlaying ? 'Playing' : 'Play'}
            </button>

            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[13px] font-semibold text-white t-global hover:border-accent-border hover:bg-accent-soft"
            >
              <Plus size={16} />
              Add to Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}