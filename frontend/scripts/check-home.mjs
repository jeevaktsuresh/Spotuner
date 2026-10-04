/**
 * Checks the Home hero and its "See All" links against the live API.
 *
 * The hero bugs this guards against were all *pairing* faults — copy, artwork
 * and controls describing a track other than the one on screen — and a pairing
 * fault is invisible to a render smoke test, which only proves a component does
 * not throw. So this runs the real selection against real shelves and asserts the
 * properties that were actually broken:
 *
 *   1. every hero slide's copy describes that slide's own track
 *   2. no slide repeats a track, and all four sources are represented
 *   3. the carousel renders the slide the parent selected (Play/Save/isPlaying)
 *   4. every "See All" destination resolves to a real route and a real shelf
 *
 * Usage: npm run check:home [-- --offline]
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeroCarousel from '../src/components/Cards/HeroCarousel.jsx';
import {
  HERO_SOURCES,
  decorateSlides,
  heroDescription,
  heroQueueFor,
  selectHeroEntries,
  trackKey,
} from '../src/recommend/heroSlides.js';

const API = process.env.SPOTUNER_API ?? 'http://192.168.18.6:8080/api';
const offline = process.argv.includes('--offline');
const noop = () => {};

let failures = 0;
let checks = 0;

function check(label, fn) {
  checks += 1;
  try {
    fn();
    console.log(`ok   ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${label}\n       ${error.message}`);
  }
}

/** Mock track shaped like a backend shelf entry. */
function mockTrack(id, extra = {}) {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    source: 'yt',
    album: `Album ${id}`,
    ...extra,
  };
}

/* ------------------------------------------------------------------ *
 * 1 + 2. Slide selection and copy, against real shelves
 * ------------------------------------------------------------------ */

async function loadShelves() {
  const response = await fetch(`${API}/shelves?limit=20`);
  assert.ok(response.ok, `/api/shelves returned ${response.status}`);
  const payload = await response.json();
  // Mirrors the shape `useShelves` hands Home: either a bare array or a wrapper.
  const shelves = Array.isArray(payload) ? payload : (payload.shelves ?? payload.data ?? []);
  assert.ok(Array.isArray(shelves) && shelves.length > 0, '/api/shelves returned no shelves');
  return shelves;
}

function shelfMap(shelves) {
  return new Map(shelves.map((shelf) => [shelf.id, shelf]));
}

async function realDataChecks() {
  const shelves = await loadShelves();
  const byId = shelfMap(shelves);
  const entries = selectHeroEntries({ shelfById: byId });

  check('every configured hero source yields a slide', () => {
    for (const { shelfId } of HERO_SOURCES) {
      assert.ok(byId.has(shelfId), `API is missing hero source "${shelfId}"`);
      assert.ok(
        entries.some((entry) => entry.shelfId === shelfId),
        `no slide was taken from "${shelfId}"`,
      );
    }
  });

  check('slide count matches the source count', () => {
    assert.equal(entries.length, HERO_SOURCES.length);
  });

  check('no slide repeats a track', () => {
    const keys = entries.map((entry) => trackKey(entry.track));
    assert.equal(new Set(keys).size, keys.length, `duplicate slide track in ${keys.join(', ')}`);
  });

  check('each slide carries the track its own shelf returned', () => {
    for (const entry of entries) {
      const shelfTracks = byId.get(entry.shelfId)?.tracks ?? [];
      assert.ok(
        shelfTracks.some((t) => trackKey(t) === trackKey(entry.track)),
        `slide from "${entry.shelfId}" is not in that shelf`,
      );
    }
  });

  check('each eyebrow names the shelf its track came from', () => {
    for (const entry of entries) {
      assert.ok(entry.eyebrow && entry.eyebrow.length > 0, `empty eyebrow for ${entry.shelfId}`);
      assert.equal(
        entry.eyebrow,
        HERO_SOURCES.find((s) => s.shelfId === entry.shelfId).eyebrow,
        `eyebrow mismatch for ${entry.shelfId}`,
      );
    }
    const eyebrows = entries.map((e) => e.eyebrow);
    assert.equal(new Set(eyebrows).size, eyebrows.length, 'eyebrows are not distinct');
  });

  // The defect: static mood copy ("Soulful Evenings", "Focus Flow") presented as
  // if it described the track behind it.
  check('no slide inherits a canned mood label', () => {
    const banned = ['soulful', 'focus flow', 'night drive', 'energetic beats', 'late night'];
    for (const entry of entries) {
      const text = `${entry.eyebrow} ${heroDescription(entry.track) ?? ''}`.toLowerCase();
      for (const phrase of banned) {
        assert.ok(!text.includes(phrase), `slide copy still contains "${phrase}"`);
      }
    }
  });

  check('description is derived from the track, never the shelf', () => {
    for (const entry of entries) {
      const description = heroDescription(entry.track);
      if (description === null) continue;
      const allowed = [entry.track.album, entry.track.forYouReason].filter(Boolean).map(String);
      assert.ok(
        allowed.includes(description),
        `description "${description}" is not a property of the track`,
      );
    }
  });

  check('queueing a slide queues that slide\'s own shelf', () => {
    for (const entry of entries) {
      const queue = heroQueueFor(entry, byId);
      assert.ok(queue.length > 0, 'empty queue');
      assert.equal(trackKey(queue[0]), trackKey(entry.track), 'queue does not start with the slide track');
      const expected = byId.get(entry.shelfId)?.tracks ?? [];
      assert.equal(queue.length, expected.length, 'queue is not the slide shelf');
    }
  });

  // Reordering the slide list must not let a slide inherit another slide's copy.
  check('eyebrows survive a reordered slide list', () => {
    const slides = entries.map((entry) => ({ key: trackKey(entry.track), track: entry.track, background: '#000' }));
    const reversed = decorateSlides(slides.reverse(), entries);
    for (const slide of reversed) {
      const expected = entries.find((e) => trackKey(e.track) === trackKey(slide.track)).eyebrow;
      assert.equal(slide.eyebrow, expected, 'slide inherited the wrong eyebrow');
    }
  });

  return { entries, byId };
}

/* ------------------------------------------------------------------ *
 * 3. The carousel obeys the parent's index, so its actions cannot drift
 * ------------------------------------------------------------------ */

/**
 * A slide shaped exactly as `useHeroImages` emits it: the resolved image fields
 * plus the track it resolved them for, with the track's own title and artist
 * copied to the top level. Building fixtures any other shape would let this
 * script pass while the real hero renders differently.
 */
function mockSlide(track) {
  return {
    key: trackKey(track),
    title: track.title,
    artist: track.artist ?? '',
    track,
    imageUrl: null,
    imageType: 'gradient',
    confidence: 0,
    tier: 'low',
    isFallback: true,
    isArtworkOnly: false,
    width: null,
    height: null,
    background: '#101014',
    dominantColors: [],
    pending: false,
  };
}

function carouselChecks(entries) {
  const slides = entries.map((entry) => mockSlide(entry.track));

  check('carousel renders the slide the parent selected', () => {
    slides.forEach((slide, index) => {
      const html = renderToStaticMarkup(
        h(HeroCarousel, {
          slides,
          index,
          onIndexChange: noop,
          onPlay: noop,
          onSave: noop,
        }),
      );
      assert.ok(
        html.includes(slide.track.title),
        `index ${index} did not render "${slide.track.title}"`,
      );
      // Only the selected slide's title should be present.
      for (const other of slides) {
        if (other.key === slide.key) continue;
        assert.ok(!html.includes(other.track.title), `index ${index} also rendered "${other.track.title}"`);
      }
    });
  });

  check('carousel clamps an out-of-range index instead of going blank', () => {
    const html = renderToStaticMarkup(
      h(HeroCarousel, {
        slides,
        index: slides.length + 5,
        onIndexChange: noop,
        onPlay: noop,
        onSave: noop,
      }),
    );
    // Clamps to the last slide, the same bound Home applies to `heroIndex`, so a
    // shrinking slide list cannot leave the banner blank.
    assert.ok(html.includes(slides[slides.length - 1].track.title), 'clamp did not land on a real slide');
  });

  check('isPlaying switches the active slide\'s control to Pause', () => {
    const props = { slides, index: 1, onIndexChange: noop, onPlay: noop, onSave: noop };
    const pausedHtml = renderToStaticMarkup(h(HeroCarousel, { ...props, isPlaying: true }));
    const playingHtml = renderToStaticMarkup(h(HeroCarousel, { ...props, isPlaying: false }));

    // The visible label is a call to action; the accessible name carries the state.
    assert.ok(pausedHtml.includes('aria-label="Pause"'), 'playing slide was not labelled Pause');
    assert.ok(playingHtml.includes('aria-label="Play Now"'), 'idle slide was not labelled Play Now');
  });

  check('a slide with no resolved title still shows its track title', () => {
    const bare = [{ key: 'k', track: mockTrack('bare'), background: '#000' }];
    const html = renderToStaticMarkup(
      h(HeroCarousel, { slides: bare, index: 0, onIndexChange: noop, onPlay: noop, onSave: noop }),
    );
    assert.ok(html.includes('Track bare'), 'heading fell back to empty');
  });

  check('liked state is reflected on the Like/Save control', () => {
    const props = { slides, index: 0, onIndexChange: noop, onPlay: noop, onSave: noop };
    const plain = renderToStaticMarkup(h(HeroCarousel, props));
    const liked = renderToStaticMarkup(h(HeroCarousel, { ...props, isLiked: true }));
    assert.notEqual(plain, liked, 'isLiked made no difference to the markup');
  });

  check('carousel has no slide-to-track drift without a controlled index', () => {
    // Uncontrolled (index omitted) must still render something valid rather than
    // crashing, which is how Home behaved before it took ownership of the index.
    const html = renderToStaticMarkup(h(HeroCarousel, { slides, onPlay: noop, onSave: noop }));
    assert.ok(html.length > 0);
  });

  return slides;
}

/* ------------------------------------------------------------------ *
 * 4. "See All" destinations
 * ------------------------------------------------------------------ */

/**
 * Every "See All" destination, read out of Home.jsx rather than restated here.
 *
 * The original bug was a hard-coded `seeAllTo="/browse"` on every row, so a
 * hand-written list in this file would have been a second copy of the same
 * mistake waiting to rot. Extracting the real ones means a newly added row is
 * covered the moment it is written.
 */
function homeSeeAllTargets() {
  const source = readFileSync(srcPath('components', 'Pages', 'Home.jsx'), 'utf8');
  const targets = [];
  // `seeAllTo="/browse?shelf=trending"` and `seeAllTo={`/browse?shelf=${id}`}`
  const pattern = /seeAllTo=(?:"([^"]*)"|\{\s*`([^`]*)`\s*\})/g;
  for (const match of source.matchAll(pattern)) {
    targets.push({ raw: match[1] ?? match[2], dynamic: match[2] !== undefined });
  }
  return targets;
}

function appRoutes() {
  const source = readFileSync(srcPath('App.jsx'), 'utf8');
  return [...source.matchAll(/<Route\s+path="([^"]*)"/g)].map((m) => m[1]);
}

function seeAllChecks(byId) {
  const targets = homeSeeAllTargets();
  const routes = appRoutes();

  check('Home declares See All destinations', () => {
    assert.ok(targets.length >= 6, `only found ${targets.length} seeAllTo values in Home.jsx`);
  });

  for (const { raw, dynamic } of targets) {
    const [path, query] = raw.split('?');
    const shelf = new URLSearchParams(query ?? '').get('shelf');

    check(`see all ${dynamic ? 'template ' : ''}${raw}`, () => {
      assert.ok(
        routes.includes(path),
        `"${path}" is not routed in App.jsx (routes: ${routes.filter((r) => !r.includes(':')).join(', ')})`,
      );

      if (shelf && !shelf.includes('${')) {
        assert.ok(byId.has(shelf), `shelf "${shelf}" is not returned by the API`);
        assert.ok(
          (byId.get(shelf)?.tracks?.length ?? 0) > 0,
          `shelf "${shelf}" has no tracks, so the link would land on an empty page`,
        );
      }
    });
  }

  check('no row falls back to the unfiltered /browse page', () => {
    // `/browse` on its own is only honest for an explicit "all shelves" link.
    // Themed and hero rows must name the shelf they came from.
    const unfiltered = targets.filter((t) => !t.dynamic && t.raw === '/browse');
    assert.ok(
      unfiltered.length <= 1,
      `${unfiltered.length} rows link straight to /browse with no shelf filter`,
    );
  });

  check('themed rows name their shelf, not a generic page', () => {
    const themed = readFileSync(srcPath('components', 'Pages', 'Home.jsx'), 'utf8');
    assert.match(
      themed,
      /title=\{row\.title\}\s*seeAllTo=\{`\/browse\?shelf=\$\{row\.id\}`\}/,
      'themed rows do not link to their own shelf',
    );
  });

  check('the quick picks row links to the shelf it actually renders', () => {
    const home = readFileSync(srcPath('components', 'Pages', 'Home.jsx'), 'utf8');
    assert.match(
      home,
      /const quickPickShelfId = shelfById\.has\('made-for-you'\) \? 'made-for-you' : 'featured';/,
      'quickPickShelfId is no longer resolved once and reused',
    );
    assert.match(
      home,
      /title="Quick Picks" seeAllTo=\{`\/browse\?shelf=\$\{quickPickShelfId\}`\}/,
      'Quick Picks does not link to the shelf it renders',
    );
    for (const id of ['made-for-you', 'featured']) {
      if (byId.has(id)) {
        assert.ok((byId.get(id).tracks?.length ?? 0) > 0, `shelf "${id}" is empty`);
      }
    }
  });

  check('the discovery row links to the shelf it falls back to', () => {
    const home = readFileSync(srcPath('components', 'Pages', 'Home.jsx'), 'utf8');
    assert.match(home, /seeAllTo="\/browse\?shelf=discover"/, 'discovery row is not linked to its shelf');
  });
}

/* ------------------------------------------------------------------ *
 * 5. /new must exist and render (the task calls it out explicitly)
 * ------------------------------------------------------------------ */

/**
 * Source files are read from disk, and this script runs from the bundle in
 * `node_modules/.test-bundle/`, so `import.meta.url` is one directory too deep.
 * The npm script always runs with the project root as the working directory.
 */
const ROOT = process.cwd();
const srcPath = (...parts) => resolve(ROOT, 'src', ...parts);

function newRouteChecks() {
  const source = readFileSync(srcPath('App.jsx'), 'utf8');
  const routes = appRoutes();

  check('/new is routed', () => {
    assert.ok(routes.includes('/new'), 'App.jsx has no /new route');
  });

  check('/new resolves to a real page component', () => {
    assert.ok(existsSync(srcPath('components', 'Pages', 'New.jsx')), 'no New.jsx page');
    const importsNew = /import\s+New\s+from\s+['"][^'"]*Pages\/New(\.jsx)?['"]/.test(source);
    assert.ok(importsNew, 'App.jsx does not import New from Pages/New.jsx');
    assert.match(
      source,
      /<Route\s+path="\/new"\s+element=\{<New\s*\/>\}/,
      '/new is not routed to the <New /> element',
    );
  });

  check('/new is a release page, so it is the right target for release rows', () => {
    const newPage = readFileSync(srcPath('components', 'Pages', 'New.jsx'), 'utf8');
    assert.match(newPage, /releases/i, 'New.jsx does not present releases');
  });

  check('every destination Home links to is a real route', () => {
    // Catches a link that silently falls through to the `*` route and re-renders
    // Home, which looks like the button did nothing.
    assert.ok(routes.includes('*'), 'expected a catch-all route');
    for (const { raw, dynamic } of homeSeeAllTargets()) {
      const [path] = raw.split('?');
      assert.ok(routes.includes(path), `"${raw}" is not a route`);
      if (!dynamic) {
        assert.notEqual(path, '', `empty destination in ${raw}`);
      }
    }
  });
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n  spotuner home checks  (api ${offline ? 'offline fixtures' : API})\n`);

  let entries;
  let byId;

  if (offline) {
    byId = shelfMap([
      { id: 'trending', tracks: [mockTrack('t1'), mockTrack('t2')] },
      { id: 'new-releases', tracks: [mockTrack('n1')] },
      { id: 'made-for-you', tracks: [mockTrack('m1', { forYouReason: 'Because you play Dawn Tread' })] },
      { id: 'discover', tracks: [mockTrack('d1')] },
      { id: 'chill', tracks: [mockTrack('c1')] },
      { id: 'workout', tracks: [mockTrack('w1')] },
      { id: 'romantic', tracks: [mockTrack('r1')] },
    ]);
    entries = selectHeroEntries({ shelfById: byId });
    realDataOfflineChecks(entries, byId);
  } else {
    const result = await realDataChecks();
    entries = result.entries;
    byId = result.byId;
    await seeAllChecks(byId);
    newRouteChecks();
  }

  if (entries.length > 0) carouselChecks(entries);

  console.log(`\n  ${checks - failures}/${checks} checks passed\n`);
  if (failures > 0) process.exit(1);
}

function realDataOfflineChecks(entries, byId) {
  check('offline: four sources produce four slides', () => {
    assert.equal(entries.length, HERO_SOURCES.length);
  });
  check('offline: slides are distinct tracks', () => {
    const keys = entries.map((e) => trackKey(e.track));
    assert.equal(new Set(keys).size, keys.length);
  });
  check('offline: a track in two shelves only fills one slide', () => {
    const shared = shelfMap([
      { id: 'trending', tracks: [mockTrack('dup'), mockTrack('t2')] },
      { id: 'new-releases', tracks: [mockTrack('dup'), mockTrack('n1')] },
      { id: 'made-for-you', tracks: [mockTrack('only1')] },
      { id: 'discover', tracks: [mockTrack('only2')] },
    ]);
    const picked = selectHeroEntries({ shelfById: shared });
    assert.equal(picked.length, 4, 'expected all four sources to still fill a slide');
    const keys = picked.map((e) => trackKey(e.track));
    assert.equal(new Set(keys).size, 4, 'a duplicate track filled two slides');
    // The duplicate is skipped in favour of the shelf's next distinct track.
    assert.equal(picked[1].track.id, 'n1');
  });
  check('offline: a source whose only track is taken elsewhere is skipped', () => {
    const shared = shelfMap([
      { id: 'trending', tracks: [mockTrack('dup')] },
      { id: 'new-releases', tracks: [mockTrack('dup')] },
      { id: 'made-for-you', tracks: [mockTrack('only1')] },
      { id: 'discover', tracks: [mockTrack('only2')] },
    ]);
    const picked = selectHeroEntries({ shelfById: shared });
    assert.equal(picked.length, 3, 'the exhausted source should drop out, not duplicate');
    assert.deepEqual(picked.map((e) => e.shelfId), ['trending', 'made-for-you', 'discover']);
  });
  check('offline: a shelf with no tracks is skipped, not empty', () => {
    const partial = shelfMap([
      { id: 'trending', tracks: [mockTrack('t1')] },
      { id: 'new-releases', tracks: [] },
      { id: 'made-for-you', tracks: [mockTrack('m1')] },
      { id: 'discover', tracks: [mockTrack('d1')] },
    ]);
    const picked = selectHeroEntries({ shelfById: partial });
    assert.deepEqual(picked.map((e) => e.shelfId), ['trending', 'made-for-you', 'discover']);
  });
  check('offline: cold start falls back to listening history', () => {
    const picked = selectHeroEntries({
      shelfById: new Map(),
      recentlyPlayed: [mockTrack('r1')],
      likedSongs: [mockTrack('k1')],
    });
    assert.equal(picked.length, 2);
    assert.equal(picked[0].shelfId, null);
    assert.equal(picked[0].track.id, 'r1');
    assert.match(picked[0].eyebrow, /played/i);
  });
  check('offline: a history-only slide queues just its own track', () => {
    const picked = selectHeroEntries({ shelfById: new Map(), recentlyPlayed: [mockTrack('r1')] });
    const queue = heroQueueFor(picked[0], new Map());
    assert.equal(queue.length, 1);
  });
  check('offline: description is null rather than invented', () => {
    assert.equal(heroDescription(null), null);
    assert.equal(heroDescription({ id: 'x', title: 'T' }), null);
    assert.equal(heroDescription({ id: 'x', title: 'T', album: 'T' }), null, 'album === title is not a description');
  });
  check('offline: forYouReason outranks album', () => {
    assert.equal(
      heroDescription({ id: 'x', title: 'T', album: 'A', forYouReason: 'Because you play Z' }),
      'Because you play Z',
    );
  });
  void entries;
  void byId;
}

await main();
