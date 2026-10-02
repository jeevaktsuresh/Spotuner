import { enrichCatalogue } from './enrich.js';
import { buildProfile } from './profile.js';
import { CARD_STRATEGIES, CARD_ORDER } from './cards.js';
import { sortByScore } from './diversity.js';

/**
 * Recommendation orchestrator.
 *
 * Order of operations, matching the spec:
 *
 *   enrich → profile → per-card filter → score → dedupe → recent filter →
 *   artist diversity → discovery → ordering → controlled shuffle
 *
 * Cold start is handled here rather than per card: when there is no behaviour
 * at all, cards fall back to popularity and regional relevance so no card is
 * ever empty for a new user.
 */

/** How many tracks each card shows. */
const CARD_SIZE = 6;

/**
 * Generate every card.
 *
 * @param {object} input
 * @param {Array} input.shelves       Raw editorial shelves from the backend.
 * @param {Array} input.likedSongs
 * @param {Array} input.recentlyPlayed
 * @param {Array} input.history       Rich per-track behaviour records.
 * @param {number} input.cardSize
 */
export function generateCards({
  shelves = [],
  likedSongs = [],
  recentlyPlayed = [],
  history = [],
  cardSize = CARD_SIZE,
} = {}) {
  const catalogue = enrichCatalogue(shelves);
  const profile = buildProfile({ likedSongs, recentlyPlayed, history, catalogue });

  const context = { catalogue, profile, likedSongs, recentlyPlayed, limit: cardSize };

  const cards = CARD_ORDER.map(({ key, title, subtitle }) => {
    const strategy = CARD_STRATEGIES[key];
    let result;

    try {
      result = strategy(context);
    } catch (error) {
      console.error(`Recommendation card "${key}" failed:`, error);
      result = { songs: [], isEmpty: true, reason: 'Unavailable' };
    }

    const songs = result.songs.slice(0, cardSize);

    return {
      key,
      card: title,
      subtitle: result.isEmpty ? result.reason : subtitle,
      songs,
      isEmpty: songs.length === 0,
      count: songs.length,
      personalised: profile.hasHistory,
      tier: profile.level.tier,
    };
  });

  return { cards, profile, catalogue };
}

/**
 * Cards whose content is a hard constraint rather than a preference.
 *
 * A cold-start fallback may substitute a *preference* (show popular music when
 * personalisation is unavailable) but it must never substitute a *constraint*.
 * Filling a "Malayalam" card with English tracks would misrepresent the card,
 * so those stay empty and report why.
 */
const CONSTRAINED_CARDS = {
  // Liked membership is a hard constraint: a cold-start user has no likes, so
  // this card must stay empty rather than filling with arbitrary tracks.
  liked: null, // handled by the explicit branch below
  malayalam: (track) => track.enriched?.language === 'Malayalam',
  tamil: (track) => track.enriched?.language === 'Tamil',
};

/**
 * Ensure no card is empty for a cold-start user.
 *
 * A brand-new listener has no signals at all, so personalised scoring has
 * nothing to work with. Preference-based cards fall back to the most prominent
 * catalogue tracks; constrained cards only ever draw from their own pool, and
 * remain honestly empty when that pool is empty.
 */
export function fillColdStartCards({ cards, catalogue, profile, likedSongs = [] }) {
  if (profile.hasHistory) return cards;

  const ranked = sortByScore(
    catalogue.map((track) => ({ track, score: track.enriched?.popularity ?? 0.5 })),
  );

  // Only genuinely liked tracks may ever appear in the Liked Songs card.
  const likedKeys = new Set(
    likedSongs.map(song => `${song.source ?? 'yt'}:${song.id}`),
  );

  return cards.map((card) => {
    if (!card.isEmpty) return card;

    if (card.key === 'liked') {
      const liked = ranked
        .filter(entry => likedKeys.has(`${entry.track.source ?? 'yt'}:${entry.track.id}`))
        .map(entry => entry.track);

      return {
        ...card,
        songs: [],
        isEmpty: liked.length === 0,
        count: 0,
        isColdStart: true,
        subtitle: liked.length === 0 ? 'No liked songs yet' : card.subtitle,
      };
    }

    const constraint = CONSTRAINED_CARDS[card.key];

    // Constrained cards may only be filled from tracks that satisfy them.
    const pool = constraint ? ranked.filter(entry => constraint(entry.track)) : ranked;

    const tracks = pool.slice(0, CARD_SIZE).map(entry => entry.track);

    if (constraint && tracks.length === 0) {
      return {
        ...card,
        songs: [],
        isEmpty: true,
        count: 0,
        isColdStart: true,
        subtitle: `No ${card.card} music in your catalogue yet`,
      };
    }

    return {
      ...card,
      songs: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album ?? '',
        artworkUrl: track.image ?? null,
        duration: track.duration ?? null,
        score: Math.round((track.enriched?.popularity ?? 0.5) * 1000) / 10,
        reason: 'Popular right now',
        track,
      })),
      isEmpty: tracks.length === 0,
      count: tracks.length,
      isColdStart: true,
    };
  });
}

export { CARD_ORDER };
export default generateCards;