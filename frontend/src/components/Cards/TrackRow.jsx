import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';
import { formatDuration } from '../../utils/formatTime';

/**
 * TrackRow — the compact horizontal list item used by Recently Played.
 *
 * Thumbnail, title/artist, duration, play button. Rows alternate their surface
 * tint via `index`, which keeps a long list scannable without extra borders.
 */
export default function TrackRow({ track, index = 0, isPlaying = false, onPlay }) {
  const title = track.title ?? 'Unknown';
  const subtitle = track.artist ?? '';

  return (
    <div
      className={`group flex items-center gap-3 rounded-[10px] px-2.5 py-2 no-drag t-global hover:bg-white/[0.06] sm:gap-4 sm:px-3 ${
        isPlaying ? 'bg-accent-soft' : index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative shrink-0">
        <Artwork
          src={track.image}
          alt={title}
          bgColor={track.bgColor ?? '#1c1822'}
          ratio={1}
          rounded="rounded-[8px]"
          className="h-10 w-10"
          sizes="40px"
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

      {/* Title + artist */}
      <div className="min-w-0 flex-1">
        <p
          className={`clamp-1 text-[12.5px] font-medium leading-tight ${
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

      {/* Duration — hidden on the narrowest screens to protect the title */}
      {track.duration ? (
        <span className="hidden shrink-0 text-[12px] tabular-nums text-label-secondary sm:block">
          {formatDuration(track.duration)}
        </span>
      ) : null}
    </div>
  );
}