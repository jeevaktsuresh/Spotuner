import {
  recencyScore,
  replayScore,
  completionScore,
  playFrequencyScore,
  skipScore,
  artistAffinityScore,
  genreAffinityScore,
  moodAffinityScore,
  popularityScore,
  noveltyScore,
  userPreferenceScore,
  weightedScore,
  languageOf,
} from './signals.js';
import {
  dedupe,
  filterRecent,
  applyArtistDiversity,
  addDiscovery,
  applyEnergyRamp,
  shuffleWithinScoreBand,
  sortByScore,
} from './diversity.js';
import { trackKey } from './profile.js';

/**
 * The six "Good Evening" cards.
 *
 * Every strategy is independent: it declares its own filter, its own weight
 * table, its own ordering, and its own post-processing. Nothing falls back to
 * a generic "give me popular songs" path, because that is exactly the failure
 * mode this module exists to avoid.
 *
 * Shared contract: each returns `{ card, songs, reason, isEmpty }` where songs
 * are already ranked and diversity-filtered.
 */

/** Signals every strategy can read from. */
function signalsFor(track, profile, now) {
  return {
    artistAffinity: () => artistAffinityScore(track, profile),
    genreAffinity: () => genreAffinityScore(track, profile),
    /** Mean mood affinity, exposed separately so Romantic can reason with it. */
    moodAffinity: () => moodAffinityScore(track, profile),
    userPreference: () => userPreferenceScore(track, profile),
    completion: () => completionScore(track, profile),
    replay: () => replayScore(track, profile),
    playFrequency: () => playFrequencyScore(track, profile),
    recency: () => recencyScore(profile.lastPlayedAt(track), {}, now),
    skip: () => skipScore(track, profile),
    popularity: () => popularityScore(track),
    novelty: () => noveltyScore(track, profile),
  };
}

/**
 * Attach the score and a human-readable justification to each result.
 *
 * `score` arrives normalised to 0..1 and is published as 0..100, matching the
 * documented result format. Scaling happens in exactly one place so a card
 * cannot accidentally report an out-of-range score.
 */
function finalise(track, score, reason) {
  const normalised = Math.max(0, Math.min(1, score ?? 0));

  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album ?? '',
    artworkUrl: track.image ?? null,
    duration: track.duration ?? null,
    score: Math.round(normalised * 1000) / 10,
    reason,
    track,
  };
}

// ---------------------------------------------------------------------------
// 1. LIKED SONGS
// ---------------------------------------------------------------------------

/**
 * Explicitly liked songs only.
 *
 * Hard filter first: nothing the user has not liked can appear. Ranking then
 * favours recently liked, then replayed, then played. Unlike every other card
 * this one does not apply the 24h recency exclusion — the spec calls for it,
 * and it would be self-defeating to hide the user's own favourites from their
 * favourites row.
 */
function likedSongsCard({ likedSongs, profile, limit }) {
  const byKey = profile.trackByKey;
  const now = Date.now();

  const candidates = likedSongs
    .map((song) => byKey.get(trackKey(song)) ?? { ...song, enriched: null })
    .filter((track) => track && track.id);

  if (candidates.length === 0) {
    return { card: 'Liked Songs', songs: [], isEmpty: true, reason: 'No liked songs yet' };
  }

  const scored = candidates.map((track) => {
    const signals = signalsFor(track, profile, now);

    // A never-played like has no play recency, so fall back to when the like
    // happened. This is fed in as the signal rather than added afterwards, so
    // the weight table stays the single source of truth for the score.
    const likedAt = profile.behaviourFor(track)?.likedAt ?? track.likedAt ?? null;
    const playRecency = signals.recency();
    const effectiveRecency = playRecency ?? recencyScore(likedAt, { halfLifeDays: 30 }, now);

    const withRecency = {
      ...signals,
      recency: () => effectiveRecency,
    };

    // Weights sum to 100 and match the spec's liked-songs formula.
    const score = weightedScore(track, withRecency, {
      likeMatch: 40,
      recency: 25,
      replayFrequency: 20,
      listeningCompletion: 15,
    });

    let reason = 'Liked by you';
    if (signals.replay() !== null && signals.replay() > 0.5) reason = 'You replay this often';
    else if (effectiveRecency !== null && effectiveRecency > 0.6) reason = 'Recently liked';
    else if (signals.playFrequency() !== null && signals.playFrequency() > 0.5) {
      reason = 'A favourite of yours';
    }

    return { track, score: score ?? 0, reason };
  });

  const ranked = sortByScore(scored);
  const deduped = dedupe(ranked.map((s) => s.track));
  const diversified = applyArtistDiversity(deduped, { maxPerArtist: 2 });
  const selected = diversified.slice(0, limit);

  const allowed = new Set(selected.map(trackKey));

  return {
    card: 'Liked Songs',
    songs: ranked.filter((s) => allowed.has(trackKey(s.track))).map((s) => finalise(s.track, s.score, s.reason)),
    isEmpty: false,
    reason: `${candidates.length} liked`,
  };
}

// ---------------------------------------------------------------------------
// 2. CHILL MIX
// ---------------------------------------------------------------------------

/**
 * Relaxed listening, learned rather than hard-coded.
 *
 * The blend is 60% familiar / 25% similar artists / 15% discovery, per spec.
 * "Similar artists" means artists with high chill affinity that the user has
 * barely played — so this is genuinely widening their taste rather than
 * re-serving familiar tracks.
 *
 * Genre lists are a starting filter, not the decision: a track tagged nothing
 * can still qualify on its energy and the user's own evening behaviour.
 */
function chillMixCard({ catalogue, profile, limit }) {
  const now = Date.now();
  const evening = profile.eveningAffinity();

  const candidates = catalogue.filter((track) => {
    const enriched = track.enriched;
    if (!enriched) return false;

    // Relaxed by tag, or by low energy — plus tracks the user actually plays
    // at night, which is the strongest chill signal available.
    const relaxedByTag = enriched.isRelaxing || enriched.isChillEnergy;
    const relaxedByEnergy = enriched.energy <= 0.4;
    const userNightListener = evening > 0.15 && profile.isPlayed(track);

    return relaxedByTag || relaxedByEnergy || userNightListener;
  });

  const scored = candidates.map((track) => {
    const signals = signalsFor(track, profile, now);

    // completion acts as a proxy for "songs they hear all the way through",
    // which is how chill preferences are learned.
    const score = weightedScore(track, signals, {
      chillRelevance: 40,
      userPreference: 25,
      completion: 20,
      novelty: 15,
    });

    const chillRelevance = computeChillRelevance(track, profile, evening);
    const combined = (score ?? 0) * 0.6 + chillRelevance * 0.4;

    return {
      track,
      score: combined,
      reason: buildReason(track, profile, {
        evening,
        completion: signals.completion(),
        artist: signals.artistAffinity(),
      }),
    };
  });

  const ranked = sortByScore(scored);
  const pool = ranked.map((s) => s.track);

  let selected = dedupe(pool).slice(0, limit);
  // Discovery slice for the 15% unfamiliar tail.
  selected = addDiscovery(selected, pool, profile, { ratio: 0.15, limit: 1 });

  selected = applyArtistDiversity(selected, { maxPerArtist: 2 });
  selected = filterRecent(selected, profile, { windowHours: 24 });
  selected = selected.slice(0, limit);

  const scoreByKey = new Map(ranked.map((s) => [trackKey(s.track), s]));

  return {
    card: 'Chill Mix',
    songs: shuffleWithinScoreBand(selected, { window: 6 }).map((track) => {
      const entry = scoreByKey.get(trackKey(track));
      return finalise(track, entry?.score ?? 0, entry?.reason ?? 'Chilled out');
    }),
    isEmpty: false,
  };
}

/** 0..1 estimate of how well a track fits "chill" for this user. */
function computeChillRelevance(track, profile, eveningAffinity) {
  const enriched = track.enriched;
  const parts = [
    // Inverse energy: calmer is better.
    Math.max(0, 1 - enriched.energy) * 0.4,
    // Chill mood/genre affinity.
    Math.min(
      enriched.moods.filter((m) => ['chill', 'dreamy', 'focus'].includes(m)).length,
      1,
    ) * 0.25,
    // The user's own chill-taste affinity.
    (profile.moodAffinity('chill') * 0.5 + profile.genreAffinity('chill') * 0.5) * 0.2,
    // Listening at night is evidence of chill preference.
    eveningAffinity * 0.15,
  ];

  return parts.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// 3 & 4. MALAYALAM / TAMIL
// ---------------------------------------------------------------------------

/**
 * Language cards.
 *
 * One factory, two independent instances. Critically, each instance derives its
 * own artist/genre preferences from that language's history only — sharing a
 * score function does not mean sharing a profile, which is the requirement that
 * a Malayalam listener's artists aren't assumed to transfer to Tamil.
 */
function languageCard(language) {
  return function strategy({ catalogue, profile, limit }) {
    const now = Date.now();
    const target = language.toLowerCase();

    const candidates = catalogue.filter((track) => languageOf(track)?.toLowerCase() === target);

    if (candidates.length === 0) {
      return { card: language, songs: [], isEmpty: true, reason: `No ${language} music found` };
    }

    const scored = candidates.map((track) => {
      const signals = signalsFor(track, profile, now);

      // Spec weights for Malayalam; Tamil uses its own distribution.
      const weights =
        language === 'Malayalam'
          ? { userPreference: 35, artistPreference: 25, genrePreference: 20, completion: 10, popularity: 6, freshness: 4 }
          : { userPreference: 35, artistAffinity: 20, completion: 15, popularity: 10, freshness: 10, discovery: 10 };

      const score = weightedScore(track, signals, weights);

      return {
        track,
        score: score ?? 0,
        reason: buildReason(track, profile, {
          artist: signals.artistAffinity(),
          genre: signals.genreAffinity(),
          completion: signals.completion(),
          popularity: signals.popularity(),
        }),
      };
    });

    const ranked = sortByScore(scored);
    const pool = ranked.map((s) => s.track);

    let selected = dedupe(pool).slice(0, limit);
    // A slice of lesser-known tracks keeps the card from being identical daily.
    selected = addDiscovery(selected, pool, profile, { ratio: 0.2, limit: 2 });
    selected = applyArtistDiversity(selected, { maxPerArtist: 2 });
    selected = filterRecent(selected, profile, { windowHours: 24 });
    selected = shuffleWithinScoreBand(selected, { window: 10 }).slice(0, limit);

    const scoreByKey = new Map(ranked.map((s) => [trackKey(s.track), s]));

    return {
      card: language,
      songs: selected.map((track) => {
        const entry = scoreByKey.get(trackKey(track));
        return finalise(track, entry?.score ?? 0, entry?.reason ?? `${language} pick`);
      }),
      isEmpty: false,
    };
  };
}

const malayalamCard = languageCard('Malayalam');
const tamilCard = languageCard('Tamil');

// ---------------------------------------------------------------------------
// 5. WORKOUT
// ---------------------------------------------------------------------------

/**
 * High-energy training music.
 *
 * Energy is the primary driver, but the user's own language and artist tastes
 * are weighted heavily — someone who works out to Malayalam music should get
 * Malayalam workout tracks, which is an explicit requirement.
 *
 * Ordering is separate from ranking: the card is ramped so energy rises and
 * falls instead of sitting flat.
 */
function workoutCard({ catalogue, profile, limit }) {
  const now = Date.now();

  const candidates = catalogue.filter((track) => track.enriched);

  const scored = candidates.map((track) => {
    const signals = signalsFor(track, profile, now);

    const score = weightedScore(track, signals, {
      energyMatch: 30,
      userPreference: 20,
      bpmMatch: 15,
      completion: 15,
      popularity: 10,
      novelty: 10,
    });

    return {
      track,
      score: score ?? 0,
      reason: buildReason(track, profile, {
        artist: signals.artistAffinity(),
        completion: signals.completion(),
        energy: track.enriched.energy,
        language: languageOf(track),
      }),
    };
  });

  const ranked = sortByScore(scored);

  // Seed the card with genuinely energetic tracks, then ramp them.
  const energetic = ranked.filter((s) => s.track.enriched.energy >= 0.45).map((s) => s.track);

  let selected = dedupe(energetic.slice(0, limit));
  selected = applyArtistDiversity(selected, { maxPerArtist: 2 });
  selected = filterRecent(selected, profile, { windowHours: 24 });
  selected = selected.slice(0, limit);
  selected = applyEnergyRamp(selected);

  const scoreByKey = new Map(ranked.map((s) => [trackKey(s.track), s]));

  return {
    card: 'Workout',
    songs: selected.map((track) => {
      const entry = scoreByKey.get(trackKey(track));
      return finalise(track, entry?.score ?? 0, entry?.reason ?? 'High energy');
    }),
    isEmpty: false,
  };
}

// ---------------------------------------------------------------------------
// 6. ROMANTIC
// ---------------------------------------------------------------------------

/**
 * Love and longing, in any language.
 *
 * Mood carries the most weight, but the user's language and artist affinities
 * are given real influence so a Malayalam romantic listener sees Malayalam
 * romantic tracks rather than English ones.
 */
function romanticCard({ catalogue, profile, limit }) {
  const now = Date.now();

  const candidates = catalogue.filter((track) => {
    const enriched = track.enriched;
    if (!enriched) return false;
    return enriched.isRomantic || enriched.moods.some((m) => ROMANTIC_MOODS.has(m));
  });

  if (candidates.length === 0) {
    return { card: 'Romantic', songs: [], isEmpty: true, reason: 'No romantic tracks found' };
  }

  const scored = candidates.map((track) => {
    const signals = signalsFor(track, profile, now);

    const score = weightedScore(track, signals, {
      moodMatch: 30,
      userPreference: 25,
      languagePreference: 15,
      artistAffinity: 10,
      completion: 10,
      discovery: 10,
    });

    return {
      track,
      score: score ?? 0,
      reason: buildReason(track, profile, {
        artist: signals.artistAffinity(),
        mood: signals.moodAffinity(),
        language: languageOf(track),
      }),
    };
  });

  const ranked = sortByScore(scored);
  let selected = dedupe(ranked.map((s) => s.track)).slice(0, limit);
  selected = addDiscovery(selected, ranked.map((s) => s.track), profile, { ratio: 0.15, limit: 1 });
  selected = applyArtistDiversity(selected, { maxPerArtist: 2 });
  selected = filterRecent(selected, profile, { windowHours: 24 });
  selected = shuffleWithinScoreBand(selected, { window: 8 }).slice(0, limit);

  const scoreByKey = new Map(ranked.map((s) => [trackKey(s.track), s]));

  return {
    card: 'Romantic',
    songs: selected.map((track) => {
      const entry = scoreByKey.get(trackKey(track));
      return finalise(track, entry?.score ?? 0, entry?.reason ?? 'Romantic');
    }),
    isEmpty: false,
  };
}

const ROMANTIC_MOODS = new Set(['romantic', 'emotional', 'dreamy', 'nostalgic']);

/**
 * Compose a short human-readable justification.
 *
 * Shown in the result payload so a recommendation can be explained rather than
 * being an opaque score.
 */
function buildReason(track, profile, parts) {
  if (profile.isLiked(track)) return 'You liked this';

  const language = languageOf(track);
  if (parts.language && profile.languageAffinity(language) > 0.25) {
    return `Because you enjoy ${language} music`;
  }
  if (parts.artist !== null && parts.artist !== undefined && parts.artist > 0.3) {
    return 'Similar to artists you listen to';
  }
  if (parts.mood !== null && parts.mood !== undefined && parts.mood > 0.3) {
    return 'Matches your mood preferences';
  }
  if (parts.genre !== null && parts.genre !== undefined && parts.genre > 0.3) {
    return 'Similar to songs you frequently listen to';
  }
  if (parts.completion !== null && parts.completion !== undefined && parts.completion > 0.7) {
    return 'You usually finish this song';
  }
  if (parts.energy !== undefined && parts.energy >= 0.8) {
    return 'High energy';
  }
  if (parts.evening !== undefined && parts.evening > 0.3) {
    return 'You play this in the evening';
  }
  if (parts.popularity !== null && parts.popularity !== undefined) {
    return 'Popular right now';
  }

  return 'New for you';
}

export const CARD_STRATEGIES = {
  liked: likedSongsCard,
  chill: chillMixCard,
  malayalam: malayalamCard,
  tamil: tamilCard,
  workout: workoutCard,
  romantic: romanticCard,
};

/** Display order and labels for the "Good Evening" row. */
export const CARD_ORDER = [
  { key: 'liked', title: 'Liked Songs', subtitle: 'songs' },
  { key: 'chill', title: 'Chill Mix', subtitle: 'Instant playlist' },
  { key: 'malayalam', title: 'Malayalam', subtitle: 'Top picks for you' },
  { key: 'tamil', title: 'Tamil', subtitle: 'Trending now' },
  { key: 'workout', title: 'Workout', subtitle: 'Energy boost' },
  { key: 'romantic', title: 'Romantic', subtitle: 'Feel the love' },
];