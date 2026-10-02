/**
 * ArtistImageProvider — official artist imagery.
 *
 * Prefers the same metadata APIs, filtering for artist-level results, and
 * expands the artist-artwork URL to its largest available rendition. The iTunes
 * `musicArtist` entity returns the artist's own catalogue art rather than a
 * single album cover, which reads much better behind a hero banner.
 */

const TIMEOUT_MS = 5000;
const UA = 'Spotuner/1.0 (+hero-image-matcher)';

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Wikipedia REST summary — free, keyless, returns a lead image if one exists. */
async function searchWikipedia(artist) {
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(artist)}` +
    '&gsrlimit=3&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600';

  const payload = await fetchJson(searchUrl);
  const pages = payload?.query?.pages;

  if (!pages) return [];

  return Object.values(pages)
    .filter((page) => page?.original?.source)
    .map((page) => ({
      url: page.original.source,
      title: page.title ?? '',
      artist,
      album: '',
      imageType: 'artist_image',
      source: 'wikipedia',
      official: true,
      queryWeight: 0.8,
    }));
}

export default {
  name: 'artist-image',

  async find(metadata) {
    if (!metadata.artist) return [];

    const results = await searchWikipedia(metadata.artist);

    // Artist imagery is inherently weaker evidence for a *song*, so it is
    // capped below album-specific matches by the scorer.
    return results.map((candidate) => ({ ...candidate, queryWeight: 0.5 }));
  },
};