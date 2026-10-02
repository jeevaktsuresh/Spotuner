import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { musicApi } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import { usePreferences } from '../../context/PreferencesContext';
import MediaCard from '../Cards/MediaCard';
import SectionHeading from '../Layout/SectionHeading';

export default function Search() {
  const [params] = useSearchParams();
  // The query is owned by the header's search field and arrives via the URL,
  // so this page only reads it — it never keeps a second copy in state.
  const query = params.get('q') ?? '';

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();
  const { musicSource, showSourceBadge } = usePreferences();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!debouncedQuery) {
        setResults(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await musicApi.searchAll(debouncedQuery, { source: musicSource });
        if (!cancelled) setResults(data);
      } catch (error) {
        console.error('Search error:', error);
        if (!cancelled) setResults(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, musicSource]);

  // Prefer the merged list. It exists on every successful multi-source response; the
  // per-source keys are a fallback for older or single-provider payloads. Reading
  // only `results.youtube` would silently drop Spotify-only results, which is
  // exactly what happens when Spotify has a track YouTube search did not surface.
  const items = results?.tracks ?? results?.youtube ?? [];

  /** Only offer a provider switch when the backend found a real counterpart. */
  const alternatesOf = (track) => track.alternates ?? [];

  function play(track) {
    setQueue(items);
    playTrack(track);
  }

  function isThisPlaying(track) {
    return isPlaying && currentTrack?.id === track.id && currentTrack?.source === track.source;
  }

  return (
    <div className="px-5 pb-8 pt-6 md:px-7">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
          Search
        </h1>
        {debouncedQuery ? (
          <p className="mt-1.5 text-[13px] text-label-secondary">
            {items.length} result{items.length === 1 ? '' : 's'} for “{debouncedQuery}”
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] text-label-secondary">
            Find songs, artists, and albums
          </p>
        )}
      </header>

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-label-secondary">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
          <span className="text-[13px]">Searching…</span>
        </div>
      ) : items.length > 0 ? (
        <>
          <SectionHeading title="Top Results" />
          <div className="shelf-x scrollbar-hide flex gap-4 pb-1">
            {items.map((track) => (
              <MediaCard
                key={`${track.source}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(track)}
                // Minimal provider hint, opt-in. Only rendered when a counterpart
                // on another provider actually exists, so it is never noise.
                badge={
                  showSourceBadge && alternatesOf(track).length > 0
                    ? `Also on ${alternatesOf(track)[0].source}`
                    : null
                }
              />
            ))}
          </div>
        </>
      ) : debouncedQuery ? (
        <div className="rounded-[14px] border border-white/[0.06] bg-surface-raised px-6 py-16 text-center">
          <SearchIcon size={26} className="mx-auto mb-3 text-white/20" />
          <p className="text-[14px] font-medium text-white/85">
            No results for “{debouncedQuery}”
          </p>
          <p className="mt-1.5 text-[12.5px] text-label-secondary">
            Try a different song or artist name
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] border border-white/[0.06] bg-surface-raised px-6 py-16 text-center">
          <SearchIcon size={26} className="mx-auto mb-3 text-white/20" />
          <p className="text-[14px] font-medium text-white/85">Use the search field above</p>
          <p className="mt-1.5 text-[12.5px] text-label-secondary">
            Start typing to find music
          </p>
        </div>
      )}
    </div>
  );
}