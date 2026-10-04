import { useMemo, useState } from 'react';
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
import useForYou from '../../hooks/useForYou';
import {
  trackKey,
  decorateSlides,
  selectHeroEntries,
  heroQueueFor,
} from '../../recommend/heroSlides';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Where each hero slide comes from, and the line that says so — see
 * `recommend/heroSlides.js`, which owns that mapping and its reasoning.
 */
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
  const { recentlyPlayed, likedSongs, toggleLike, playlists, history } = useLibrary();
  const { currentTrack, isPlaying, isLoading, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const flat = useMemo(() => shelves.flatMap((s) => s.tracks ?? []), [shelves]);

  const shelfById = useMemo(() => {
    const map = new Map();
    for (const shelf of shelves) map.set(shelf.id, shelf);
    return map;
  }, [shelves]);

  /**
   * Hero slides, one per named source. The pairing rules — and why each exists —
   * live in `recommend/heroSlides.js`.
   */
  const heroEntries = useMemo(
    () => selectHeroEntries({ shelfById, recentlyPlayed, likedSongs }),
    [shelfById, recentlyPlayed, likedSongs],
  );

  // Resolve hero imagery asynchronously; the carousel paints immediately. Raw
  // tracks go in, not the paired entries: `useHeroImages` keys its cache on the
  // track's own identity, and an entry without a top-level id would collapse
  // every slide onto the same placeholder key.
  const { slides: resolvedSlides } = useHeroImages(heroEntries.map((entry) => entry.track));

  const slides = useMemo(
    () => decorateSlides(resolvedSlides, heroEntries),
    [resolvedSlides, heroEntries],
  );

  /**
   * Which slide the banner is showing.
   *
   * Held here and passed down, so the Play/Like/Save handlers and the playing
   * state are all derived from the same value the carousel renders. Previously
   * the carousel advanced on its own while every handler stayed bound to
   * `slides[0]`, so advancing the banner left the controls playing a different
   * song than the one on screen.
   */
  const [heroIndex, setHeroIndex] = useState(0);
  const activeIndex = slides.length === 0 ? 0 : Math.min(heroIndex, slides.length - 1);
  const activeTrack = slides[activeIndex]?.track ?? null;

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

  /**
   * Quick Picks is backed by one shelf, and the row's "See All" has to name that
   * same shelf — the id is resolved once here and used for both, so the link can
   * never point at a different shelf than the row shows.
   */
  const quickPickShelfId = shelfById.has('made-for-you') ? 'made-for-you' : 'featured';
  const quickPickShelf = shelfById.get(quickPickShelfId);
  const quickPickTracks = quickPickShelf?.tracks ?? [];

  /**
   * Personalised "Made For You" row.
   *
   * `useForYou` was already written for this and is safe to use here as-is: it
   * summarises listening into a compact profile on the device, sends only
   * relative affinities (no titles, timestamps or ids), keys its browser cache on
   * a digest of that profile so two listeners cannot share one, and short-circuits
   * to `tracks: []` when there is nothing to personalise from. `useRecommendations`
   * above is pure client-side, so this is the only caller of
   * `POST /api/discovery/foryou` and nothing is requested twice.
   *
   * Gated on the catalogue being loaded, because `buildProfileSummary` reads
   * language and genre tags off it; firing earlier would send a thinner profile
   * than necessary. The static `discover` shelf stands in whenever the
   * personalised shelf is unavailable or the listener is new.
   */
  const {
    tracks: forYouTracks,
    hasProfile: hasForYouProfile,
    loading: forYouLoading,
  } = useForYou({
    scope: 'global',
    limit: 12,
    catalogue: flat,
    likedSongs,
    recentlyPlayed,
    history,
    enabled: !loading,
  });

  const forYouFallback = shelfById.get('discover')?.tracks ?? [];
  const forYouTracksToShow = forYouTracks.length > 0 ? forYouTracks : forYouFallback;

  /**
   * Theme rows.
   *
   * Titles come from the shelf itself rather than from labels written here. The
   * hard-coded ones ("Chill Mix", "Workout Hits", "Romantic Evening") had drifted
   * away from what the shelves actually returned — the shelves call them "Chill &
   * Relax", "Workout Energy" and "Romantic" — which is the same defect as the hero
   * copy: a confident label over music that does not match it.
   *
   * Each row also carries its own `seeAllTo`, so "See All" lands on the page that
   * actually holds that row's music.
   */
  const themedRows = useMemo(
    () =>
      ['chill', 'workout', 'romantic']
        .map((id) => ({ id, title: shelfById.get(id)?.title, tracks: shelfById.get(id)?.tracks ?? [] }))
        .filter((row) => row.tracks.length > 0 && row.title),
    [shelfById],
  );

  function play(items, item) {
    setQueue(items);
    playTrack(item);
  }

  function isThisPlaying(item) {
    return isPlaying && currentTrack?.id === item?.id && currentTrack?.source === item?.source;
  }

  /**
   * Liked state for the visible slide's track.
   *
   * Byte-for-byte the same rule `LibraryContext.toggleLike` applies — strict `id`
   * *and* `source` equality, with no defaulting. Any looser check here disagrees
   * with the write: a track whose sources differ on an absent field would render
   * "Liked", and pressing the button would then like it again instead of
   * removing the like, so the label would never change.
   */
  const activeIsLiked = Boolean(
    activeTrack?.id &&
      likedSongs.some((song) => song.id === activeTrack.id && song.source === activeTrack.source),
  );

  /**
   * What "Play Now" queues.
   *
   * The visible slide's own shelf, not the flattened pool. Queuing `flat` put
   * several hundred unrelated tracks behind the hero song, so the next track after
   * it was effectively random.
   */
  const heroQueue = useMemo(() => {
    const entry = heroEntries.find((candidate) => trackKey(candidate.track) === trackKey(activeTrack));
    return heroQueueFor(entry, shelfById);
  }, [activeTrack, heroEntries, shelfById]);

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
{/* ===== Hero =====
          Controlled: `activeIndex` is the single source of truth for what is on
          screen, and every action below reads it. */}
      {slides.length > 0 ? (
        <HeroCarousel
          slides={slides}
          index={activeIndex}
          onIndexChange={setHeroIndex}
          isPlaying={isThisPlaying(activeTrack)}
          isLoading={isLoading && isThisPlaying(activeTrack)}
          isLiked={activeIsLiked}
          onPlay={() => activeTrack && play(heroQueue, activeTrack)}
          onSave={() => activeTrack && toggleLike(activeTrack)}
        />
      ) : null}

      {/* ===== Good Evening — one algorithm per card ===== */}
      {quickPicks.length > 0 ? (
        <section className="mt-9">
          <SectionHeading title={greeting()} />

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
          <SectionHeading title="Quick Picks" seeAllTo={`/browse?shelf=${quickPickShelfId}`} />

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
          <SectionHeading title="Trending Now" seeAllTo="/browse?shelf=trending" />

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
          <SectionHeading title="Latest Releases" seeAllTo="/new" />

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

      {/* ===== Made For You — personalised, with the Discover shelf as fallback =====
          Renders the same `forYouTracks` it falls back to, so the row is
          indistinguishable from the static one while the request is in flight or
          has failed. The subtitle names which of the two is on screen, so the
          "personalised" claim is never made over a shelf. */}
      {forYouTracksToShow.length > 0 ? (
        <section className="mt-9">
          <SectionHeading
            title="Made For You"
            seeAllTo="/browse?shelf=discover"
          />

          {forYouLoading && !hasForYouProfile ? (
            <p className="mb-3 text-[11.5px] text-label-tertiary">
              Learning what you listen to…
            </p>
          ) : forYouTracks.length === 0 ? (
            <p className="mb-3 text-[11.5px] text-label-tertiary">
              {hasForYouProfile
                ? 'Not enough plays yet to personalise — showing Discover.'
                : 'Play a few tracks and this row becomes personal.'}
            </p>
          ) : null}

          <ShelfRow>
            {forYouTracksToShow.map((track) => (
              <WideCard
                key={`${track.source ?? 'yt'}-${track.id}`}
                title={track.title}
                subtitle={track.artist}
                image={track.image}
                bgColor={track.bgColor}
                isPlaying={isThisPlaying(track)}
                onPlay={() => play(forYouTracksToShow, track)}
              />
            ))}
          </ShelfRow>
        </section>
      ) : null}

      {/* ===== Theme rows, each a real backend shelf ===== */}
      {themedRows.map((row) => (
        <section key={row.id} className="mt-9">
          <SectionHeading title={row.title} seeAllTo={`/browse?shelf=${row.id}`} />

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