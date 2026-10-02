/**
 * Editorial shelves backing the New/Home grids. Each row is a themed YouTube
 * search, so the cards show real, playable music instead of placeholder art.
 *
 * The three rows that were previously hardcoded to a fixed year or a vague
 * "latest" phrase — `featured` was literally `'trending songs 2026'` — are served
 * by the discovery pipeline instead, which re-derives queries from the current
 * date and ranks by real freshness signals. Static shelves remain here for the
 * genuinely static categories (charts curation, mood, editorial).
 *
 * Moved verbatim out of `server.js` when the backend moved to a Worker: it is
 * content, not HTTP, and both the Worker and the Express fallback need it.
 */

export const SHELF_QUERIES = [
  { id: 'trending', title: 'Trending Now', kind: 'editorial', query: 'trending songs' },
  { id: 'new-releases', title: 'New This Week', kind: 'album', query: 'new latest songs' },
  { id: 'recent', title: 'Recent Releases', kind: 'album', query: 'latest music releases' },
  { id: 'updated-playlists', title: 'Updated Playlists', kind: 'playlist', query: 'best playlist hits' },
  { id: 'trending', title: 'Trending Songs', kind: 'track', query: 'trending music hits' },
  { id: 'everyones-listening', title: "Everyone's Listening To…", kind: 'playlist', query: 'popular songs everyone loves' },
  { id: 'top-100', title: 'Daily Top 100', kind: 'playlist', query: 'top 100 songs' },
  { id: 'city-charts', title: 'City Charts', kind: 'playlist', query: 'bollywood hit songs' },
  { id: 'only-on', title: 'Only on This App', kind: 'album', query: 'exclusive music videos' },
  { id: 'dj-mixes', title: 'Latest DJ Mixes', kind: 'album', query: 'dj remix songs' },
  { id: 'on-tour', title: 'Now on Tour', kind: 'playlist', query: 'live concert songs' },
  { id: 'coming-soon', title: 'Coming Soon', kind: 'album', query: 'upcoming songs' },
  { id: 'best-new', title: 'Best New Songs', kind: 'track', query: 'best new songs this week' },
  { id: 'made-for-you', title: 'Made For You', kind: 'track', query: 'songs for you' },

  // Language shelves. The recommender's Malayalam/Tamil cards filter strictly
  // by script, so without these rows those cards have no candidate pool at all
  // — the generic shelves above return almost exclusively Latin-script titles.
  //
  // These do NOT trust the query. A YouTube search for "malayalam latest songs"
  // returns Tamil music in bulk, so each language shelf carries several targeted
  // queries and the rows are assembled by detecting the language of every result
  // and keeping only what actually matches. `language` is the target code;
  // `queries` widens the pool. See `lib/language/` and `getShelves`.
  {
    id: 'malayalam',
    title: 'Malayalam',
    kind: 'track',
    query: 'malayalam songs',
    language: 'ml',
    queries: [
      'malayalam music',
      'malayalam film songs',
      'malayalam hits',
      'malayalam latest songs',
      'malayalam movie songs',
      'malayalam romantic songs',
    ],
  },
  {
    id: 'malayalam-hits',
    title: 'Malayalam Hits',
    kind: 'track',
    query: 'malayalam hit songs',
    language: 'ml',
    queries: ['malayalam super hit songs', 'malayalam popular songs', 'malayalam new songs'],
  },
  {
    id: 'tamil',
    title: 'Tamil',
    kind: 'track',
    query: 'tamil songs',
    language: 'ta',
    queries: [
      'tamil music',
      'tamil film songs',
      'tamil hits',
      'tamil latest songs',
      'tamil movie songs',
      'tamil romantic songs',
    ],
  },
  {
    id: 'tamil-hits',
    title: 'Tamil Hits',
    kind: 'track',
    query: 'tamil hit songs',
    language: 'ta',
    queries: ['tamil super hit songs', 'tamil popular songs', 'tamil new songs'],
  },
  {
    id: 'hindi',
    title: 'Hindi',
    kind: 'track',
    query: 'hindi songs',
    language: 'hi',
    queries: ['hindi music', 'hindi film songs', 'hindi hits', 'hindi latest songs'],
  },
  {
    id: 'telugu',
    title: 'Telugu',
    kind: 'track',
    query: 'telugu songs',
    language: 'te',
    queries: ['telugu music', 'telugu hits', 'telugu latest songs'],
  },
  {
    id: 'kannada',
    title: 'Kannada',
    kind: 'track',
    query: 'kannada songs',
    language: 'kn',
    queries: ['kannada music', 'kannada hits', 'kannada latest songs'],
  },
  {
    id: 'bengali',
    title: 'Bengali',
    kind: 'track',
    query: 'bengali songs',
    language: 'bn',
    queries: ['bengali music', 'bengali hits', 'bangla songs'],
  },

  // Mood shelves backing the Chill and Workout cards. These queries name the
  // activity and mood rather than relying on genre tags alone.
  { id: 'chill', title: 'Chill & Relax', kind: 'playlist', query: 'chill relaxing lofi music' },
  { id: 'workout', title: 'Workout Energy', kind: 'playlist', query: 'workout gym energy music' },
  { id: 'romantic', title: 'Romantic', kind: 'playlist', query: 'romantic love songs' },
  { id: 'listen-now', title: 'Listen Now', kind: 'editorial', query: 'listen now songs' },
  { id: 'discover', title: 'Discover', kind: 'editorial', query: 'discover new music' },
];

/**
 * Shelf ids that must come from the ranked discovery pipeline.
 *
 * These three are the ones that used to show whatever a fixed-year query happened
 * to return. Serving them through discovery means the Home grid's headline rows
 * are genuinely freshness-ranked rather than merely named that way.
 */
export const DISCOVERY_SHELF_IDS = new Set(['trending', 'new-releases', 'recent']);