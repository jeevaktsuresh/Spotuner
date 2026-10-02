import { normalize } from './text.js';

/**
 * Query generation.
 *
 * A single "title + artist" query is unreliable: for a soundtrack track it
 * returns the film's stills, and for a single it returns fan art. This module
 * emits several weighted queries so the matcher can pick whichever returns the
 * strongest candidate.
 */

/** Queries that describe the exact track/song itself. */
const SONG_QUERIES = [
  { template: ['{title}', '{artist}'], weight: 1.0, intent: 'song' },
  { template: ['{title}', '{album}'], weight: 0.9, intent: 'song' },
  { template: ['{album}', '{artist}'], weight: 0.85, intent: 'album' },
  { template: ['{title}', 'official'], weight: 0.8, intent: 'promotional' },
  { template: ['{title}', 'official poster'], weight: 0.7, intent: 'promotional' },
  { template: ['{title}', 'movie'], weight: 0.6, intent: 'soundtrack' },
  { template: ['{title}', 'official still'], weight: 0.55, intent: 'soundtrack' },
  { template: ['{album}', 'cover'], weight: 0.75, intent: 'album' },
];

/** Queries that describe the artist as a whole. */
const ARTIST_QUERIES = [
  { template: ['{artist}', 'official'], weight: 0.95, intent: 'artist' },
  { template: ['{artist}', 'wallpaper'], weight: 0.5, intent: 'artist' },
];

/**
 * Build the ordered query plan for a piece of content.
 *
 * Empty fields (a track with no album) drop out of their template, so a
 * missing value degrades the query rather than producing `"title undefined"`.
 * Duplicates are removed case-insensitively, keeping the highest weight.
 */
export function buildQueries(metadata) {
  const fields = {
    title: metadata.title?.trim() ?? '',
    artist: metadata.artist?.trim() ?? '',
    album: metadata.album?.trim() ?? '',
  };

  const seen = new Map();

  const add = (template, weight, intent) => {
    // Template keys are written as `{title}`; strip the braces before lookup,
    // otherwise every lookup misses and the whole plan comes back empty.
    const parts = template
      .map((key) => fields[key.replace(/[{}]/g, '')])
      .filter((part) => part && part.length > 0);

    if (parts.length === 0) return;

    const query = parts.join(' ');
    const key = query.toLowerCase();

    const existing = seen.get(key);
    if (existing && existing.weight >= weight) return;

    seen.set(key, { query, weight, intent });
  };

  for (const { template, weight, intent } of SONG_QUERIES) add(template, weight, intent);

  // The artist query is only worth running when the artist is a real
  // collaborator name rather than a single "Unknown" placeholder.
  if (fields.artist && !/^(unknown|various artists)$/i.test(fields.artist)) {
    for (const { template, weight, intent } of ARTIST_QUERIES) add(template, weight, intent);
  }

  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}

/**
 * Fold every artist name into a single primary name.
 *
 * "Aneesh & Sarkar & Hruday" is a collaboration; image backends index each
 * artist separately, so the lead name is usually the best single lookup.
 */
export function primaryArtist(artist) {
  const normalized = normalize(artist);
  if (!normalized) return '';
  return normalized.split(' ')[0] ?? '';
}