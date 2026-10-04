import { Play, Pause } from 'lucide-react';
import Artwork from '../Artwork/Artwork';
import { formatDuration } from '../../utils/formatTime';

/**
 * TrackRow — the compact horizontal list item used by Recently Played, artist
 * song lists and expanded playlists.
 *
 * The row itself is the control. It used to be a plain `<div>` whose only
 * actionable part was a play button that faded in on hover, which left the row
 * untappable on a touch device and unreachable by keyboard at any size. As a
 * button the whole row is one target, it is focusable, and it carries the
 * accessible name.
 *
 * That rules out a nested button, so the play glyph over the thumbnail is
 * decorative: on pointer devices it still appears on hover exactly as before,
 * and on touch it is permanent via `play-reveal`.
 */
export default function TrackRow({ track, index = 0, isPlaying = false, onPlay }) {
  const title = track.title ?? 'Unknown';
  const subtitle = track.artist ?? '';

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}`}
      className={`tap-row group relative flex w-full items-center gap-3 rounded-[10px] py-2 pl-3 pr-2.5 text-left no-drag t-global hover:bg-white/[0.06] focus-visible:bg-white/[0.06] sm:gap-4 sm:pr-3 ${
        isPlaying ? 'bg-accent-soft' : index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
      }`}
    >
      {/* Accent rail: the currently playing row has to be identifiable at a
          glance in a long list, and a coloured title alone is easy to miss. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent transition-opacity duration-200 ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Thumbnail */}
      <span className="relative shrink-0">
        <Artwork
          src={track.image}
          alt={title}
          bgColor={track.bgColor ?? '#1c1822'}
          ratio={1}
          rounded="rounded-[8px]"
          className="h-10 w-10"
          sizes="40px"
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

      {/* Title + artist.
          No `block` alongside `clamp-1`: both set `display`, and the utility
          would win and silently drop the line clamp. */}
      <span className="min-w-0 flex-1">
        <span
          className={`clamp-1 text-[12.5px] font-medium leading-tight ${
            isPlaying ? 'text-accent' : 'text-white'
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

      {/* Duration — hidden on the narrowest screens to protect the title */}
      {track.duration ? (
        <span className="hidden shrink-0 text-[12px] tabular-nums text-label-secondary sm:block">
          {formatDuration(track.duration)}
        </span>
      ) : null}
    </button>
  );
}