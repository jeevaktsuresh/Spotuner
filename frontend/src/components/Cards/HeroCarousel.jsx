import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2, BookmarkPlus, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * HeroCarousel — the wide "RECOMMENDED FOR YOU" banner.
 *
 * Renders whatever `slides` it is given. Each slide carries the matcher's
 * verdict:
 *
 *   imageUrl + isArtworkOnly -> artwork shown blurred behind a scrim, never
 *                               stretched to the banner's aspect ratio
 *   imageUrl (landscape)     -> used as-is
 *   no imageUrl              -> the generated gradient only
 *
 * Auto-advances, and pauses on hover so the banner never moves under the
 * cursor.
 *
 * ## Which slide is showing
 *
 * The actions in this banner (Play Now, Save) belong to the *visible* slide, so
 * the parent has to know which one that is. Two supported modes:
 *
 *   controlled   pass `index`; every transition calls `onIndexChange` and the
 *                parent renders the action handlers from the same value. This
 *                is what Home does — the two can never disagree.
 *   standalone   omit `index` and the component keeps its own, so it still works
 *                as a plain banner.
 *
 * `onIndexChange` is reported for every transition in either mode, including the
 * auto-advance and the arrows — not just the pagination dots.
 */
export default function HeroCarousel({
  slides,
  index: controlledIndex,
  onIndexChange,
  isPlaying,
  isLoading,
  isLiked = false,
  onPlay,
  onSave,
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const count = slides.length;
  const isControlled = controlledIndex !== undefined;
  const index = isControlled ? controlledIndex : internalIndex;

  // Clamp during render rather than via an effect, so a shrinking slide set
  // never leaves `index` pointing past the end for a frame.
  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  if (!isControlled && safeIndex !== index) setInternalIndex(safeIndex);

  /** Every transition goes through here, so the reported index cannot drift. */
  const goTo = useCallback(
    (next) => {
      if (!isControlled) setInternalIndex(next);
      onIndexChange?.(next);
    },
    [isControlled, onIndexChange],
  );

  useEffect(() => {
    if (count <= 1 || paused) return undefined;

    timerRef.current = setTimeout(() => goTo((safeIndex + 1) % count), 6000);
    return () => clearTimeout(timerRef.current);
  }, [safeIndex, count, paused, goTo]);

  if (count === 0) return null;

  const slide = slides[safeIndex];
  const useBlurredArtwork = Boolean(slide.imageUrl && slide.isArtworkOnly);

  // The heading is the one piece of text the banner cannot do without. Image
  // resolution supplies it, but it is derived from the *track*, so fall back to
  // the track's own title rather than ever rendering an empty <h1>.
  const heading = slide.title || slide.track?.title || '';
  const subheading = slide.artist || slide.track?.artist || '';

  return (
    <section
      className="relative isolate overflow-hidden rounded-[16px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {/* Base layer: the generated gradient, always present as the safety net */}
      <div
        className="absolute inset-0 -z-20"
        style={{ background: slide.background }}
        aria-hidden="true"
      />

      {/* Artwork layer */}
      {slide.imageUrl ? (
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <img
            src={slide.imageUrl}
            alt=""
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={`h-full w-full object-cover ${
              useBlurredArtwork
                ? // Square art is blurred and over-scaled so it fills a wide
                  // banner without visible distortion.
                  'scale-125 blur-2xl opacity-55 saturate-[1.15]'
                : 'opacity-40'
            }`}
          />
          {/* Scrim guarantees text contrast regardless of artwork */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-accent/25 via-transparent to-accent-magenta/10" />
        </div>
      ) : null}

      <div className="flex min-h-[286px] flex-col justify-end p-7 sm:p-9">
        <div className="max-w-[440px]">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">
            {slide.eyebrow ?? 'Recommended for you.'}
          </p>

          <h1 className="mt-2.5 text-[38px] font-bold leading-[1.08] tracking-tight text-white sm:text-[46px]">
            {heading}
          </h1>

          {subheading ? (
            <p className="mt-2 text-[14px] font-medium text-white/80">{subheading}</p>
          ) : null}

          {slide.description ? (
            <p className="mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-white/65">
              {slide.description}
            </p>
          ) : null}

          {/* Match confidence, surfaced only when the image is a real match */}
          {!slide.isFallback && slide.confidence > 0 ? (
            <p className="mt-2 text-[11px] uppercase tracking-wider text-white/40">
              {slide.tier} confidence · {slide.imageType?.replace(/_/g, ' ')}
            </p>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={onPlay}
              disabled={isLoading || !slide.track}
              // The visible label stays "Play Now", but that is a call to action,
              // not the state. This slide's track is already playing, so the
              // control is a pause and has to say so.
              aria-label={isLoading ? 'Starting playback' : isPlaying ? 'Pause' : 'Play Now'}
              className="flex items-center gap-2.5 rounded-full bg-accent px-7 py-3 text-[13.5px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_24px_-6px_var(--color-accent-glow)] active:scale-[0.97] disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" className="ml-0.5" />
              )}
              Play Now
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={!slide.track}
              // This is the visible slide's track, and `isLiked` is that track's
              // library state, so the label tracks the button's own effect rather
              // than a fixed string.
              aria-pressed={isLiked}
              aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              className="flex items-center gap-2.5 rounded-full border border-white/25 px-6 py-3 text-[13.5px] font-semibold text-white t-global hover:border-white/45 hover:bg-white/[0.08] disabled:opacity-60"
            >
              <BookmarkPlus size={16} />
              {isLiked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Pagination + arrows */}
        {count > 1 ? (
          <div className="mt-7 flex items-center justify-end gap-5">
            <div className="flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === safeIndex}
                  className={`h-1.5 rounded-full t-global ${
                    i === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo((safeIndex - 1 + count) % count)}
                aria-label="Previous slide"
                className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm t-global hover:bg-black/65"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => goTo((safeIndex + 1) % count)}
                aria-label="Next slide"
                className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm t-global hover:bg-black/65"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}