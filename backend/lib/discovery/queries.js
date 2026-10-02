/**
 * Discovery query generation.
 *
 * Every query is built from the current date at call time. Nothing here
 * hardcodes a year: a hardcoded `trending songs 2026` stops describing anything
 * in January, and that is precisely how a "trending" shelf turns into a shelf of
 * whatever happened to be popular that year.
 *
 * Trending and latest are deliberately separate query families. They ask
 * different questions of YouTube's index — "what is getting attention now" versus
 * "what came out recently" — and on this data source the only difference between
 * them is the wording, so the wording has to be right.
 */

/** Language code -> the word YouTube search actually understands. */
const LANGUAGE_NAMES = {
  ml: 'Malayalam',
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  kn: 'Kannada',
  bn: 'Bengali',
  pa: 'Punjabi',
  mr: 'Marathi',
  gu: 'Gujarati',
};

/**
 * Human-readable calendar parts, derived at call time.
 *
 * The month is included in some queries because YouTube's index responds to it:
 * "latest hindi songs March 2026" returns different rows than
 * "latest hindi songs October 2026", whereas a bare year barely narrows anything.
 */
export function calendar(now = new Date()) {
  const month = now.toLocaleString('en-US', { month: 'long' });
  const shortMonth = now.toLocaleString('en-US', { month: 'short' });

  // ISO-8601 week number, useful for "this week" style queries.
  const isoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = isoDate.getUTCDay() || 7;
  isoDate.setUTCDate(isoDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(isoDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((isoDate - yearStart) / 86400000 + 1) / 7);

  return {
    year: now.getUTCFullYear(),
    month,
    shortMonth,
    week,
    yearLast: now.getUTCFullYear() - 1,
  };
}

export function languageName(code) {
  return LANGUAGE_NAMES[code] || null;
}

/**
 * Queries that surface music people are currently paying attention to.
 *
 * These lean on recency wording ("this week", the current month and year) rather
 * than a single generic query, because a generic query returns the same settled
 * catalogue forever. The year rotation is what keeps this shelf moving.
 */
export function trendingQueries({ language = null, now = new Date() } = {}) {
  const c = calendar(now);
  const name = languageName(language);

  if (name) {
    return [
      `trending ${name} songs ${c.year}`,
      `latest trending ${name} songs`,
      `viral ${name} songs ${c.year}`,
      `top ${name} songs this week`,
      `new trending ${name} songs`,
      `${name} trending music ${c.month} ${c.year}`,
      `popular ${name} songs ${c.month} ${c.year}`,
    ];
  }

  return [
    `trending songs ${c.year}`,
    `latest trending songs ${c.month} ${c.year}`,
    `viral songs ${c.year}`,
    `top songs this week`,
    `trending songs India`,
    `new viral songs ${c.month} ${c.year}`,
    `songs everyone is listening ${c.year}`,
    `trending music ${c.shortMonth} ${c.year}`,
  ];
}

/**
 * Queries that surface recently released music.
 *
 * Weighted towards explicit recency phrasing and away from "viral"/"trending",
 * because a viral query mostly returns older songs that are still popular — the
 * exact failure mode this module exists to fix.
 */
export function latestQueries({ language = null, now = new Date() } = {}) {
  const c = calendar(now);
  const name = languageName(language);

  if (name) {
    return [
      `new ${name} songs ${c.year}`,
      `latest ${name} songs ${c.month} ${c.year}`,
      `new ${name} songs this week`,
      `new ${name} songs this month`,
      `${name} new song release ${c.year}`,
      `new ${name} music ${c.month} ${c.year}`,
    ];
  }

  return [
    `new songs ${c.year}`,
    `latest songs ${c.month} ${c.year}`,
    `new music releases ${c.year}`,
    `new songs this week`,
    `new songs this month`,
    `latest releases ${c.month} ${c.year}`,
    `new songs released ${c.month} ${c.year}`,
  ];
}

/**
 * Queries used to build a personalised candidate pool.
 *
 * Unlike the other two families this one is derived from the listener rather than
 * from the calendar, so it accepts a profile and asks about the things they
 * already listen to. It deliberately mixes in a broad discovery query: a purely
 * affinity-driven pool narrows over time into an echo chamber of the user's own
 * back catalogue, which is the opposite of what a "For You" shelf should do.
 *
 * Falls back to the latest family when no profile is available, so a cold user
 * still gets a current, varied pool rather than nothing.
 */
export function forYouQueries({ language = null, profile = null, now = new Date() } = {}) {
  const c = calendar(now);
  const name = languageName(language);

  const preferredArtists = topKeys(profile?.artists, 3);
  const preferredGenres = topKeys(profile?.genres, 2);
  const preferredLanguages = topKeys(profile?.languages, 2)
    .map((code) => languageName(code))
    .filter(Boolean);

  const queries = [];

  // 1. The listener's strongest affinities, by artist.
  for (const artist of preferredArtists) {
    queries.push(`${artist} new songs ${c.year}`);
    queries.push(`${artist} latest songs ${c.month} ${c.year}`);
  }

  // 2. Their preferred genres.
  for (const genre of preferredGenres) {
    queries.push(`new ${genre} songs this week`);
  }

  // 3. Languages they actually listen to, which may differ from the shelf scope.
  for (const lang of preferredLanguages.slice(0, 2)) {
    queries.push(`new ${lang} songs ${c.month} ${c.year}`);
    queries.push(`trending ${lang} songs ${c.year}`);
  }

  // 4. Always keep the pool wide. Without this the shelf converges on what the
  //    user already knows and never surfaces anything new.
  queries.push(`new songs ${c.month} ${c.year}`);
  queries.push(`new songs this week`);
  if (name) queries.push(`new ${name} songs this week`);

  return [...new Set(queries)].slice(0, 10);
}

/** The strongest keys of a normalised affinity map, highest first. */
function topKeys(affinity, count) {
  if (!affinity || typeof affinity !== 'object') return [];
  return Object.entries(affinity)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, count)
    .map(([key]) => key)
    .filter(Boolean);
}

/**
 * Region hint for YouTube's search locale.
 *
 * Spotuner targets an Indian audience, so regional shelves bias `gl: 'IN'`. The
 * global shelf keeps the default so international music is not filtered out.
 */
export function regionFor(language, { global = false } = {}) {
  if (global) return null;
  return 'IN';
}