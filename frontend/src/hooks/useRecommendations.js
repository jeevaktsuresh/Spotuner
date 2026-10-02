import { useMemo } from 'react';
import { generateCards, fillColdStartCards } from '../recommend/index.js';
import { useLibrary } from '../context/LibraryContext';

/**
 * useRecommendations — drives the "Good Evening" card row.
 *
 * Scoring runs synchronously in a memo because the catalogue is already in
 * memory; there is no network call and no reason to defer it. Memoising on the
 * catalogue and behavioural inputs means the expensive ranking only re-runs
 * when something it depends on actually changes.
 */
export default function useRecommendations(shelves, { cardSize = 6 } = {}) {
  const { likedSongs, recentlyPlayed, history } = useLibrary();

  return useMemo(() => {
    const { cards, profile, catalogue } = generateCards({
      shelves,
      likedSongs,
      recentlyPlayed,
      history,
      cardSize,
    });

    return {
      cards: fillColdStartCards({ cards, catalogue, profile, likedSongs }),
      profile,
      tier: profile.level.tier,
      isColdStart: !profile.hasHistory,
      totalPlays: profile.totals.plays,
    };
  }, [shelves, likedSongs, recentlyPlayed, history, cardSize]);
}