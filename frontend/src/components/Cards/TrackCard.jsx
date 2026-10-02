import Artwork from '../Artwork/Artwork';
import PlayButton from '../Artwork/PlayButton';

/**
 * TrackCard — compact square card used in the Library grid.
 */
export default function TrackCard({ track, isPlaying = false, onPlay }) {
  return (
    <div className="group min-w-0">
      <div className="relative">
        <Artwork
          src={track.image}
          alt={track.title}
          bgColor={track.bgColor ?? '#1c1822'}
          ratio={1}
          rounded="rounded-[10px]"
          className="w-full"
          imgClassName="art-hover"
          sizes="184px"
        />

        <div className="play-reveal absolute bottom-2.5 right-2.5">
          <PlayButton
            isPlaying={isPlaying}
            onClick={onPlay}
            label={`Play ${track.title}`}
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
        {track.title}
      </p>
      {track.artist ? (
        <p className="clamp-1 mt-0.5 text-[11.5px] leading-tight text-label-secondary">
          {track.artist}
        </p>
      ) : null}
    </div>
  );
}
