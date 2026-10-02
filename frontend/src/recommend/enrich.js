import { detectLanguage, normalize, tokenize } from './text.js';

/**
 * Track enrichment.
 *
 * The catalogue arrives from YouTube with only title/artist/album/duration, so
 * the recommender needs a normalised view of each track. This module produces
 * it, and is explicit about what is measured versus inferred:
 *
 *   measured  — duration, language (via Unicode script blocks)
 *   inferred  — genres, moods, energy (keyword lexicons)
 *   unknown   — bpm, releaseDate, true popularity
 *
 * `null` is returned for anything genuinely unknowable. Scoring code treats
 * `null` as "no evidence" and reweights accordingly, rather than treating it as
 * zero — that distinction is what stops unknown BPM from looking like a bad
 * BPM.
 */

/**
 * Genre lexicons. Each genre lists the terms that imply it.
 *
 * These are heuristic tags, not a genre classifier: they describe what the
 * text mentions, not what the audio sounds like.
 */
const GENRE_LEXICONS = {
  chill: ['chill', 'chillout', 'relax', 'relaxing', 'calm', 'soothing', 'smooth', 'mellow', 'sunday'],
  lofi: ['lofi', 'lo-fi', 'lofi beats', 'jazzhop', 'chillhop'],
  acoustic: ['acoustic', 'unplugged', 'acoustic cover', 'folk'],
  indie: ['indie', 'independent', 'alt pop', 'alternative', 'underground'],
  ambient: ['ambient', 'drone', 'soundscape', 'meditation', 'spa'],
  'r&b': ['r&b', 'rnb', 'r and b', 'soul', 'neo soul', 'neo-soul'],
  'soft pop': ['soft pop', 'dream pop', 'synthpop', 'pop'],
  pop: ['pop', 'chart', 'hits', 'top 40'],
  rock: ['rock', 'guitar', 'metal', 'punk', 'alternative rock'],
  electronic: ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'future bass', 'synth'],
  'hip-hop': ['hip hop', 'hip-hop', 'rap', 'trap', 'boom bap'],
  classical: ['classical', 'orchestra', 'instrumental', 'symphony', 'piano'],
  folk: ['folk', 'sufi', 'qawwali', 'ghazal', 'bhajan'],
  devotional: ['devotional', 'bhajan', 'aarti', 'prasad', 'devotional song'],
  dance: ['dance', 'dj', 'remix', 'party'],
};

/** Mood lexicons, shared with the energy model. */
const MOOD_LEXICONS = {
  chill: ['chill', 'calm', 'relax', 'relaxing', 'soothing', 'mellow', 'smooth', 'sleep', 'study', 'lofi'],
  romantic: ['love', 'lover', 'romance', 'romantic', 'heart', 'proposal', 'wedding', 'miss you', 'kiss'],
  emotional: ['emotional', 'heartbreak', 'sad', 'tears', 'cry', 'lonely', 'miss', 'alone', 'hurt'],
  energetic: ['workout', 'gym', 'energy', 'power', 'pump', 'run', 'race', 'fight', 'rock', 'hustle'],
  motivational: ['motivation', 'inspirational', 'never give up', 'believe', 'dream', 'success'],
  dreamy: ['dreamy', 'dream', 'floating', 'clouds', 'night', 'starlight', 'moonlight'],
  nostalgic: ['nostalgia', 'memories', '90s', 'retro', 'old'],
  party: ['party', 'club', 'celebration', 'dance floor', 'festival'],
  focus: ['focus', 'deep work', 'concentration', 'productivity'],
  aggressive: ['angry', 'rage', 'hate', 'fight', 'war', 'violence'],
  dark: ['dark', 'horror', 'fear', 'mysterious'],
};

/** BPM bands per genre when audio analysis isn't available. */
const GENRE_BPM_RANGE = {
  electronic: [118, 132],
  'hip-hop': [85, 100],
  dance: [120, 128],
  pop: [100, 120],
  rock: [110, 140],
  indie: [90, 115],
  'r&b': [70, 95],
  chill: [70, 95],
  lofi: [70, 85],
  acoustic: [80, 105],
  folk: [75, 100],
  devotional: [70, 95],
  ambient: [55, 75],
  classical: [60, 90],
  'soft pop': [80, 105],
};

/**
 * Energy targets used to build a workout ramp.
 *
 * Documented so the sequencing step is tunable and its intent is legible:
 * the plan rises to a peak in the middle, then eases out.
 */
export const ENERGY_RAMP = [0.55, 0.8, 1.0, 0.82, 0.6];

/** Read every keyword field a track offers, as one searchable blob. */
function searchableText(track) {
  return normalize(
    `${track?.title ?? ''} ${track?.artist ?? ''} ${track?.album ?? ''} ${
      Array.isArray(track?.genres) ? track.genres.join(' ') : ''
    } ${Array.isArray(track?.moods) ? track.moods.join(' ') : ''}`,
  );
}

/** Return every genre whose keywords appear in the text. */
function matchGenres(text) {
  const found = [];

  for (const [genre, keywords] of Object.entries(GENRE_LEXICONS)) {
    if (keywords.some((kw) => text.includes(normalize(kw)))) found.push(genre);
  }

  return found;
}

/** Return every mood whose keywords appear in the text. */
function matchMoods(text) {
  const found = [];

  for (const [mood, keywords] of Object.entries(MOOD_LEXICONS)) {
    if (keywords.some((kw) => text.includes(normalize(kw)))) found.push(mood);
  }

  return found;
}

/**
 * Infer an energy value in 0..1.
 *
 * Genre is the primary evidence because it is the most reliable tag available.
 * Loud/energetic mood words raise it further. Tracks with no genre evidence sit
 * at a neutral 0.5 rather than being pushed to zero, so an untagged track is
 * neither promoted nor buried by the absence of data.
 */
function inferEnergy(genres, moods) {
  if (genres.length === 0) {
    if (moods.includes('energetic') || moods.includes('aggressive')) return 0.85;
    if (moods.includes('motivational') || moods.includes('party')) return 0.75;
    if (moods.includes('chill') || moods.includes('dreamy')) return 0.25;
    return 0.5;
  }

  const bands = {
    electronic: 0.85,
    dance: 0.85,
    'hip-hop': 0.8,
    rock: 0.82,
    pop: 0.68,
    'soft pop': 0.45,
    indie: 0.55,
    'r&b': 0.4,
    chill: 0.25,
    lofi: 0.2,
    acoustic: 0.35,
    folk: 0.35,
    devotional: 0.3,
    ambient: 0.15,
    classical: 0.25,
  };

  const values = genres.map((g) => bands[g]).filter((v) => typeof v === 'number');
  const base = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0.5;

  let energy = base;
  if (moods.includes('energetic') || moods.includes('aggressive')) energy += 0.15;
  if (moods.includes('motivational')) energy += 0.1;
  if (moods.includes('chill') || moods.includes('dreamy')) energy -= 0.15;

  return Math.max(0, Math.min(1, energy));
}

/** Midpoint of the genre's BPM band, or null when no genre matched. */
function inferBpm(genres) {
  for (const genre of genres) {
    const range = GENRE_BPM_RANGE[genre];
    if (range) return Math.round((range[0] + range[1]) / 2);
  }

  return null;
}

/**
 * Normalise a raw catalogue track into the shape the scorer consumes.
 *
 * `popularity` is a *relative* signal: the ordering within an editorial shelf
 * is itself a popularity signal, so position is used as a proxy. It is
 * explicitly not a global play count.
 */
export function enrichTrack(track, { shelfPosition = null, shelfSize = 1 } = {}) {
  const text = searchableText(track);

  const genres = matchGenres(text);
  const moods = matchMoods(text);
  const detected = detectLanguage(track);

  // The backend classifies language in the data layer, where it can see the
  // search context and the album as well as the title. That verdict is
  // authoritative; the local detector only fills gaps for tracks that arrived
  // without one (a saved library, a cached shelf). Without this the frontend
  // would be doing its own, weaker classification and disagreeing with the API.
  //
  // The name — not the ISO code — is stored, because that is the shape the
  // language cards and `languageAffinity` already compare against.
  const classified = track?.language && track.language !== 'unknown';
  const language = classified ? track.languageName : detected.language;
  const languageConfidence = classified
    ? track.languageConfidence ?? 0
    : detected.confidence === 'high'
      ? 0.9
      : detected.confidence === 'low'
        ? 0.5
        : 0;

  // Position 0 is treated as strongest. Normalised against shelf size so
  // ranks are comparable across shelves of different lengths.
  const popularity =
    shelfPosition === null
      ? null
      : Math.max(0, Math.min(1, 1 - shelfPosition / Math.max(1, shelfSize)));

  return {
    ...track,
    enriched: {
      language,
      languageConfidence,
      genres,
      moods,
      energy: inferEnergy(genres, moods),
      // Genuinely unknown without audio analysis — scored as "no evidence".
      bpm: inferBpm(genres),
      popularity,
      tokens: tokenize(text),
      // Convenience flags used by several card strategies.
      isRelaxing:
        moods.some((m) => CHILL_MOODS.has(m)) ||
        genres.some((g) => CHILL_GENRES.has(g)),
      isRomantic: moods.some((m) => ROMANTIC_MOODS.has(m)),
      isHighEnergy: inferEnergy(genres, moods) >= 0.65,
      isChillEnergy: inferEnergy(genres, moods) <= 0.35,
    },
  };
}

export const CHILL_MOODS = new Set(['chill', 'dreamy', 'focus']);
export const CHILL_GENRES = new Set(['chill', 'lofi', 'ambient', 'acoustic', 'r&b', 'soft pop']);
export const ROMANTIC_MOODS = new Set(['romantic', 'dreamy', 'emotional', 'nostalgic']);

/** Enrich a whole catalogue, preserving shelf order for the popularity proxy. */
export function enrichCatalogue(shelves) {
  const enriched = [];

  for (const shelf of shelves) {
    const tracks = shelf?.tracks ?? [];
    const size = tracks.length || 1;

    tracks.forEach((track, index) => {
      enriched.push(enrichTrack(track, { shelfPosition: index, shelfSize: size }));
    });
  }

  return enriched;
}