import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000
});

// Discovery runs many YouTube queries on a cold cache, so it needs a longer
// budget than search or the first request of a session times out. Warm requests
// return in well under a second because the backend serves from cache.
const discoveryApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 60000
});

/** Build the shared discovery query string. */
function discoveryQuery({ scope, limit, exclude, maxPerArtist }) {
  const params = new URLSearchParams();
  params.set('scope', scope);
  params.set('limit', String(limit));
  if (maxPerArtist != null) params.set('maxPerArtist', String(maxPerArtist));
  if (exclude?.length) params.set('exclude', exclude.slice(0, 60).join(','));
  return `?${params.toString()}`;
}

// Response interceptor
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error);
    throw error.response?.data?.error || 'Something went wrong';
  }
);

export const musicApi = {
  // Editorial shelves for the New/Home grids, built from YouTube search.
  // This is a cold-cache build of every shelf via live YouTube queries and can
  // run past 30s, so it uses the long-budget client. On the 15s default the
  // Artists page failed with "0 artists" while the request was still succeeding
  // server-side.
  getShelves: (limitPerShelf = 6) =>
    discoveryApi.get(`/shelves?limit=${encodeURIComponent(limitPerShelf)}`).then(r => r.data),

  // ===== Discovery =====
  // Trending and latest are separate concepts with separate ranking, so they are
  // separate calls. Both are cached server-side and served stale-while-revalidate.

  /** Music currently getting attention. `scope` is 'global' or a language code. */
  getTrending: ({ scope = 'global', limit = 20, exclude = [], maxPerArtist = 2 } = {}) =>
    discoveryApi
      .get(`/discovery/trending${discoveryQuery({ scope, limit, exclude, maxPerArtist })}`)
      .then(r => r.data),

  /** Recently released music. */
  getLatest: ({ scope = 'global', limit = 20, exclude = [], maxPerArtist = 2 } = {}) =>
    discoveryApi
      .get(`/discovery/latest${discoveryQuery({ scope, limit, exclude, maxPerArtist })}`)
      .then(r => r.data),

  /** Both rows in one round trip, for the Home grid. */
  getDiscoveryHome: ({ scope = 'global', limit = 20, exclude = [] } = {}) =>
    discoveryApi.get(`/discovery/home${discoveryQuery({ scope, limit, exclude })}`).then(r => r.data),

  /** Cache TTLs, scoring weights and probe health. */
  getDiscoveryStatus: () => api.get('/discovery/status'),

  /**
   * Resolve artist pictures for a batch of names.
   *
   * Names are POSTed because they contain commas, ampersands and dots, which do
   * not survive a query string intact. Returns a name -> url map; a name with
   * no image maps to null so the caller can keep its placeholder.
   */
  getArtistImages: (names) =>
    api
      .post('/artists/images', { names }, { timeout: 45000 })
      // `api` has a response interceptor that already unwraps to response.data,
      // so this resolves to the body itself, not an axios response.
      .then((body) => body?.images ?? {}),

  /**
   * Personalised "For You" shelf.
   *
   * POSTed because the profile is an object rather than a query parameter. The
   * body carries only a compact affinity summary — never track titles, timestamps
   * or per-play records — so private listening data stays on the device.
   */
  getForYou: (payload) => discoveryApi.post('/discovery/foryou', payload).then((r) => r.data),

  // Search
  //
  // `source` selects providers: 'all' merges YouTube and Spotify, 'youtube' and
  // 'spotify' restrict to one, 'auto' uses whatever the backend has available.
  // The merged list arrives on `tracks`; `youtube` is retained for older callers.
  searchAll: (query, { source = 'all', limit = 20 } = {}) =>
    api.get(
      `/search/all?query=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}&limit=${limit}`
    ),

  searchYouTube: (query) => api.get(`/search/youtube?query=${encodeURIComponent(query)}`),

  /** Providers available in this deployment, and which can serve audio. */
  getProviders: () => api.get('/providers'),

  // Song details
  getSong: (source, id) => api.get(`/song/${source}/${id}`),
  getAlbum: (source, id) => api.get(`/album/${source}/${id}`),

  // Stream URL
  getStreamUrl: (source, id) => api.get(`/stream/${source}/${id}`),

  /**
   * Resolve a playable source for a track from any provider.
   *
   * Returns the stream URL *and* the provider it came from, so a Spotify-sourced
   * track can be shown as playing via YouTube without the UI inferring anything.
   * Falls back to YouTube when the track's own provider cannot serve audio.
   */
  resolvePlayable: (source, id, preferred = 'auto') =>
    discoveryApi
      .get(`/play/${source}/${encodeURIComponent(id)}?source=${encodeURIComponent(preferred)}`)
      .then((r) => r.data),

  /**
   * Resolve hero/banner images for one or more content items.
   *
   * Sends the whole set in a single request so the backend can enforce visual
   * diversity across slides. Individual items are cached server-side.
   */
  matchHeroImages: (items) =>
    api.post('/hero-image', { items }, { timeout: 30000 }),
};
