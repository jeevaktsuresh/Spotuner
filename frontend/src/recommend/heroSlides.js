/**
 * Hero slide selection for the Home carousel.
 *
 * Kept out of the page component for two reasons. It is pure, so it can be
 * checked against real shelf data without mounting anything; and the mistakes it
 * exists to prevent are all about *pairing*, which is much easier to get right
 * when the pairing is one function rather than index arithmetic inside JSX.
 *
 * The rule: a slide is `(source, track)` and nothing else. The eyebrow says where
 * the track came from, the description is read off the track itself, and the
 * track is the song the banner will actually play.
 */

/**
 * Where each slide comes from, and the line that says so.
 *
 * The eyebrow is the honest label for the shelf the track was taken from, so the
 * text above the title always describes the music underneath it.
 */
export const HERO_SOURCES = [
  { shelfId: 'trending', eyebrow: 'Trending this week.' },
  { shelfId: 'new-releases', eyebrow: 'New this week.' },
  { shelfId: 'made-for-you', eyebrow: 'Made for you.' },
  { shelfId: 'discover', eyebrow: 'Worth a listen.' },
];

/** Identity of a track, source-aware — the same rule `toggleLike` matches on. */
export function trackKey(track) {
  return `${track?.source ?? 'yt'}:${track?.id ?? 'unknown'}`;
}

/**
 * One line of supporting copy, taken from the track itself.
 *
 * Deliberately never invents a mood. The hero used to carry static strings like
 * "Night Drive — late-night anthems" that were paired onto tracks by index, so the
 * banner confidently described music it was not showing. If there is nothing true
 * to say it says nothing: `HeroCarousel` drops the paragraph entirely.
 */
export function heroDescription(track) {
  if (!track) return null;
  if (track.forYouReason) return track.forYouReason;
  const album = String(track.album ?? '').trim();
  if (album && album !== track.title) return album;
  return null;
}

/**
 * Pick at most one track per named source.
 *
 * Only the first usable track of each shelf is taken, so four slides are four
 * different songs from four different places rather than one shelf's top four.
 * Duplicates are dropped across sources, so a track appearing in both `trending`
 * and `new-releases` cannot occupy two slides.
 *
 * With no shelves at all, the listener's own history is used instead, labelled
 * accordingly and with a null `shelfId` — there is no shelf to queue from.
 *
 * @param {object} input
 * @param {Map<string, object>} input.shelfById  shelf id -> shelf
 * @param {Array} [input.recentlyPlayed]
 * @param {Array} [input.likedSongs]
 * @returns {Array<{shelfId: string|null, eyebrow: string, track: object}>}
 */
export function selectHeroEntries({ shelfById, recentlyPlayed = [], likedSongs = [] } = {}) {
  const seen = new Set();
  const entries = [];

  for (const { shelfId, eyebrow } of HERO_SOURCES) {
    const track = (shelfById?.get?.(shelfId)?.tracks ?? []).find(
      (candidate) => candidate?.id && !seen.has(trackKey(candidate)),
    );
    if (!track) continue;
    seen.add(trackKey(track));
    entries.push({ shelfId, eyebrow, track });
  }

  if (entries.length === 0) {
    for (const track of [...recentlyPlayed, ...likedSongs]) {
      if (!track?.id || seen.has(trackKey(track))) continue;
      seen.add(trackKey(track));
      entries.push({ shelfId: null, eyebrow: 'Because you played these.', track });
      if (entries.length >= HERO_SOURCES.length) break;
    }
  }

  return entries;
}

/**
 * The shelf's own tracks, for queueing behind the slide's song.
 *
 * Playing a hero slide used to queue the flattened pool of every shelf, which put
 * several hundred unrelated tracks behind the song on screen so the next one was
 * effectively random. Now the rest of that slide's shelf follows it.
 */
export function heroQueueFor(entry, shelfById) {
  if (!entry?.track) return [];
  const shelfTracks = entry.shelfId ? (shelfById?.get?.(entry.shelfId)?.tracks ?? []) : [];
  return shelfTracks.length > 0 ? shelfTracks : [entry.track];
}

/**
 * Attach eyebrow and description to resolved hero slides.
 *
 * Matched on the slide's own track identity rather than by position, so a slide
 * list that is filtered or reordered cannot pick up another slide's copy. The
 * previous version looked the source up by `track.id` alone, which collides
 * whenever two providers share an id.
 */
export function decorateSlides(slides, entries) {
  const eyebrowByKey = new Map(entries.map((entry) => [trackKey(entry.track), entry.eyebrow]));

  return (slides ?? []).map((slide) => ({
    ...slide,
    eyebrow: eyebrowByKey.get(trackKey(slide.track)) ?? 'Recommended for you.',
    description: heroDescription(slide.track),
  }));
}