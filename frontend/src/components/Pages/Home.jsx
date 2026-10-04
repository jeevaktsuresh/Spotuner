import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import useShelves from '../../hooks/useShelves';
import SectionHeading from '../Layout/SectionHeading';
import ShelfRow from '../Layout/ShelfRow';
import HeroCarousel from '../Cards/HeroCarousel';
import QuickCard from '../Cards/QuickCard';
import QuickPick from '../Cards/QuickPick';
import RankedCard from '../Cards/RankedCard';
import MediaCard from '../Cards/MediaCard';
import WideCard from '../Cards/WideCard';
import useHeroImages from '../../hooks/useHeroImages';
import useRecommendations from '../../hooks/useRecommendations';
import useDiscovery from '../../hooks/useDiscovery';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Curated copy for the hero slides — static so the banner never reads empty. */
const HERO_COPY = [
  {
    eyebrow: 'Recommended for you.',
    title: 'Soulful Evenings',
    description: 'A handpicked mix of melodies to match your mood.',
  },
  {
    eyebrow: 'Made for you.',
    title: 'Focus Flow',
    description: 'Instrumental textures that keep you in the zone.',
  },
  {
    eyebrow: 'Because you played these.',
    title: 'Night Drive',
    description: 'Late-night anthems and warm vocal harmonies.',
  },
  {
    eyebrow: 'Trending this week.',
    title: 'Top 40 India',
    description: 'The songs everyone has on repeat right now.',
  },
];

function ShelfSkeleton() {
  return (
    <ShelfRow>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[186px] shrink-0">
          <div className="aspect-[1.66] w-full animate-pulse rounded-[10px] bg-white/[0.05]" />
          <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
        </div>
      ))}
    </ShelfRow>
  );
}

/**
 * Home — the discovery front page.
 *
 * Structure mirrors the reference top to bottom: hero carousel, a "Good
 * Evening" quick-pick strip driven by the recommendation algorithms, Quick
 * Picks, Trending Now, Recently Played, then one row per themed backend shelf.
 * Every row is fed by the backend's YouTube-backed shelves, so artwork is real
 * and playable, and every label describes the music actually shown.
 */
export default function Home() {
  const { shelves, loading, error } = useShelves(10);
  const { recentlyPlayed, likedSongs, toggleLike, playlists } = useLibrary();
  const { currentTrack, isPlaying, isLoading, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const flat = useMemo(() => shelves.flatMap((s) => s.tracks ?? []), [shelves]);

  /**
   * Hero source content, chosen before image matching so the matcher always
   * receives real metadata to work with.
   */
  const heroTracks = useMemo(() => {
    const pool = flat.length > 0 ? flat : [...recentlyPlayed, ...likedSongs];
    if (pool.length === 0) return [];

    // Spread across the pool so slides don't all come from one shelf.
    return HERO_COPY.slice(0, 4).map((copy, i) => ({
      ...copy,
      track: pool[(i * Math.max(1, Math.floor(pool.length / 4))) % pool.length],
    }));
  }, [flat, recentlyPlayed, likedSongs]);

  // Resolve hero imagery asynchronously; the carousel paints immediately.
  const { slides: heroSlides } = useHeroImages(heroTracks);

  const enrichedSlides = useMemo(
    () =>
      heroSlides.map((slide) => {
        const source = heroTracks.find((t) => t.track?.id === slide.track?.id);
        return {
          ...slide,
          eyebrow: source?.eyebrow ?? slide.eyebrow,
          description: source?.description ?? slide.description,
        };
      }),
    [heroSlides, heroTracks],
  );

  const activeSlide = enrichedSlides[0];
  const activeTrack = activeSlide?.track ?? null;

  /**
   * "Good Evening" cards.
   *
   * Each card runs its own selection algorithm over the enriched catalogue,
   * scored against the user's listening history. This replaced a placeholder
   * that simply walked the shelf pool by index.
   */
  const { cards: recommendationCards } = useRecommendations(shelves);

  const quickPicks = useMemo(
    () =>
      recommendationCards.map((card) => ({
        title: card.card,
        subtitle:
          card.isEmpty
            ? card.subtitle
            : card.key === 'liked'
              ? `${card.count} song${card.count === 1 ? '' : 's'}`
              : card.subtitle,
        track: card.songs[0]?.track ?? null,
        card,
      })),
    [recommendationCards],
  );

  const recent = recentlyPlayed.slice(0, 8);

  /**
   * Real shelves by id.
   *
   * Rows are sourced from the backend's shelves rather than invented here.
   * The earlier "Made For You" row hard-coded labels like "Daily Mix 1" and
   * bound each to a track picked by index, which produced confident-looking
   * rows describing music that had nothing to do with the label.
   */
  const shelfById = useMemo(() => {
    const map = new Map();
    for (const shelf of shelves) map.set(shelf.id, shelf);
    return map;
  }, [shelves]);

  /**
   * Trending and latest come from the discovery pipeline, which ranks by real
   * freshness signals rather than trusting a query. The shelf fallback exists so
   * the rows still render if discovery is unavailable.
   */
  const { trendingTracks, latestTracks } = useDiscovery({ limit: 12 });

  const trending = trendingTracks.length > 0
    ? trendingTracks
    : shelfById.get('trending')?.tracks ?? [];

  const latest = latestTracks.length > 0
    ? latestTracks
    : shelfById.get('new-releases')?.tracks ?? [];

  const quickPickShelf = shelfById.get('made-for-you') ?? shelfById.get('featured');
  const quickPickTracks = quickPickShelf?.tracks ?? [];

  /** Theme rows, each backed by its own backend shelf of real playable tracks. */
  const themedRows = useMemo(
    () =>
      [
        { id: 'chill', title: 'Chill Mix' },
        { id: 'workout', title: 'Workout Hits' },
        { id: 'romantic', title: 'Romantic Evening' },
        { id: 'discover', title: 'Made For You' },
      ]
        .map(({ id, title }) => ({ id, title, tracks: shelfById.get(id)?.tracks ?? [] }))
        .filter((row) => row.tracks.length > 0),
    [shelfById],
  );

  function play(items, item) {
    setQueue(items);
    playTrack(item);
  }

  function isThisPlaying(item) {
    return isPlaying && currentTrack?.id === item?.id && currentTrack?.source === item?.source;
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="h-[286px] w-full animate-pulse rounded-[16px] bg-white/[0.05]" />
        <div className="mt-9">
          <ShelfSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
{/* ===== Hero ===== */}
      {enrichedSlides.length > 0 ? (
        <HeroCarousel
          slides={enrichedSlides}
          isPlaying={isThisPlaying(activeTrack)}
          isLoading={isLoading && isThisPlaying(activeTrack)}
          onPlay={() => activeTrack && play(flat, activeTrack)}
          onSave={() => activeTrack && toggleLike(activeTrack)}
        />
      ) : null}

      {/* ===== Good Evening — one algorithm per card ===== */}
      {quickPicks.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title={greeting()} seeAllTo="/browse" />

          <ShelfRow gap="gap-3.5">
            {quickPicks.map(({ title, subtitle, track, card }) => {
              // Playing a card queues that card's own recommended tracks, so
              // the queue reflects the algorithm's output rather than the
              // whole shelf.
              const cardTracks = card.songs.map(song => song.track).filter(Boolean);

              return (
                <QuickCard
                  key={title}
                  title={title}
                  subtitle={subtitle}
                  image={track?.image}
                  bgColor={track?.bgColor ?? '#3a1b30'}
                  isPlaying={isThisPlaying(track)}
                  isLoading={isLoading && isThisPlaying(track)}
                  onPlay={() => {
                    if (cardTracks.length === 0) return;
                    setQueue(cardTracks);
                    playTrack(cardTracks[0]);
                  }}
                />
              );
            })}
          </ShelfRow>
        </section>
      ) : null}

      {/* ===== Quick Picks ===== */}
      {quickPickTracks.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title="Quick Picks" seeAllTo="/browse" />

          <ShelfRow gap="gap-3.5">
            {quickPickTracks.slice(0, 8).map((track) => (
              <QuickPick
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor ?? '#3a1b30'}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(quickPickTracks, track)}
              />
            ))}
          </ShelfRow>
        </section>
      ) : null}

      {/* ===== Trending Now ===== */}
      {trending.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title="Trending Now" seeAllTo="/browse" />

          <ShelfRow>
            {trending.map((track, i) => (
              <RankedCard
                key={`${track.source ?? 'yt'}-${track.id}`}
                rank={i + 1}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(trending, track)}
              />
            ))}
          </ShelfRow>
        </section>
      ) : null}

      {/* ===== Latest Releases ===== */}
      {latest.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title="Latest Releases" seeAllTo="/browse" />

          <ShelfRow>
            {latest.map((track) => (
              <MediaCard
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(latest, track)}
              />
            ))}
          </ShelfRow>
        </section>
      ) : null}

      {/* ===== Recently Played ===== */}
      <section className="mt-9">
        <SectionHeading title="Recently Played" seeAllTo="/library" />

        {recent.length > 0 ? (
          <ShelfRow>
            {recent.map((track) => (
              <MediaCard
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(recent, track)}
              />
            ))}
          </ShelfRow>
        ) : (
          <EmptyRow
            message="Nothing played yet"
            hint="Search for a song and it'll show up here"
            to="/search"
            cta="Browse Music"
          />
        )}
      </section>

      {/* ===== Theme rows, each a real backend shelf ===== */}
      {themedRows.map((row) => (
        <section key={row.id} className="mt-9">
          <SectionHeading title={row.title} seeAllTo="/browse" />

          <ShelfRow>
            {row.tracks.map((track) => (
              <WideCard
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(row.tracks, track)}
              />
            ))}
          </ShelfRow>
        </section>
      ))}

      {/* ===== Playlists shortcut ===== */}
      {playlists.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title="Your Playlists" seeAllTo="/playlists" />

          <ShelfRow>
            {playlists.slice(0, 8).map((playlist) => (
              <Link
                key={playlist.id}
                to="/playlists"
                className="group w-[186px] shrink-0"
              >
                <div className="overflow-hidden rounded-[10px] bg-white/[0.05]">
                  {playlist.image ? (
                    <img
                      src={playlist.image}
                      alt=""
                      loading="lazy"
                      className="aspect-[1.66] w-full object-cover art-hover"
                    />
                  ) : (
                    <div className="grid aspect-[1.66] w-full place-items-center bg-gradient-to-br from-accent/25 to-accent/5">
                      <span className="text-[12px] font-semibold text-accent">♪</span>
                    </div>
                  )}
                </div>
                <p className="clamp-1 mt-2.5 text-[12.5px] font-semibold text-white">
                  {playlist.name}
                </p>
<p className="text-[11.5px] text-label-secondary">
                  {playlist.tracks.length} song{playlist.tracks.length === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </ShelfRow>
        </section>
      ) : null}

      {error ? (
        <p className="mt-10 text-center text-[12.5px] text-label-secondary">
          Music service unavailable — the backend needs to be running on port 3001.
        </p>
      ) : null}
    </div>
  );
}

function EmptyRow({ message, hint, to, cta }) {
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-surface-raised px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-white">{message}</p>
      <p className="mt-1.5 text-[12.5px] text-label-secondary">{hint}</p>
      <Link
        to={to}
        className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_20px_-6px_var(--color-accent-glow)]"
      >
        {cta}
      </Link>
    </div>
  );
}