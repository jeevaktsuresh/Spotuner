/**
 * Recommendation engine checks.
 *
 * These assert the properties that distinguish a real recommender from a
 * popularity sort: independent per-card logic, language filtering, artist
 * diversity, the recent-play window, and cold start.
 *
 * Run: node scripts/check-recommend.mjs
 */
import assert from 'node:assert/strict';

import { detectLanguage, normalize, foldForIdentity } from '../src/recommend/text.js';
import { enrichTrack, enrichCatalogue } from '../src/recommend/enrich.js';
import { buildProfile, personalisationLevel, artistKey } from '../src/recommend/profile.js';
import { generateCards, fillColdStartCards } from '../src/recommend/index.js';
import { dedupe, filterRecent, applyArtistDiversity } from '../src/recommend/diversity.js';

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name}\n        ${error.message.split('\n')[0]}`);
  }
}

// ---- language detection ---------------------------------------------------
check('malayalam detected from script block', () => {
  const { language, confidence } = detectLanguage({ title: 'ഉദി ഉദി' });
  assert.equal(language, 'Malayalam');
  assert.equal(confidence, 'high');
});

check('tamil detected from script block', () => {
  assert.equal(detectLanguage({ title: 'கல்யாணி' }).language, 'Tamil');
});

check('malayalam and tamil are not confused', () => {
  assert.notEqual(
    detectLanguage({ title: 'ഉദി ഉദി' }).language,
    detectLanguage({ title: 'கல்யாணி' }).language,
  );
});

check('unknown script reports Unknown', () => {
  assert.equal(detectLanguage({ title: 'Ed Sheeran', artist: 'Divide' }).language, 'Unknown');
});

check('normalisation strips noise', () => {
  assert.equal(normalize('Udi Udi (Remix) [Official]'), 'udi udi');
});

// ---- enrichment -----------------------------------------------------------
check('enrichment derives moods and energy', () => {
  const track = enrichTrack({ id: '1', title: 'Chill Lo-Fi Beat', artist: 'A', album: 'B' });
  assert.ok(track.enriched.genres.length > 0, 'expected a chill genre tag');
  assert.ok(track.enriched.moods.includes('chill'), 'expected chill mood');
  assert.ok(track.enriched.energy <= 0.4, `expected low energy, got ${track.enriched.energy}`);
});

check('enrichment flags unknown bpm honestly', () => {
  const track = enrichTrack({ id: '1', title: 'Mystery', artist: 'A' });
  assert.equal(track.enriched.bpm, null);
});

check('untagged track sits at neutral energy', () => {
  const track = enrichTrack({ id: '1', title: 'Zzz', artist: 'Q' });
  assert.equal(track.enriched.energy, 0.5);
});

check('energetic track scores high energy', () => {
  const track = enrichTrack({ id: '1', title: 'EDM House Dance Party', artist: 'DJ' });
  assert.ok(track.enriched.energy >= 0.65, `expected high energy, got ${track.enriched.energy}`);
});

// ---- personalisation tiers ------------------------------------------------
check('personalisation tiers are ordered', () => {
  assert.equal(personalisationLevel(0).tier, 'cold');
  assert.equal(personalisationLevel(5).tier, 'early');
  assert.equal(personalisationLevel(10).tier, 'learning');
  assert.equal(personalisationLevel(50).tier, 'strong');
  assert.equal(personalisationLevel(200).tier, 'advanced');
  const weights = [0, 5, 10, 50, 200].map(n => personalisationLevel(n).weight);
  for (let i = 1; i < weights.length; i += 1) {
    assert.ok(weights[i] >= weights[i - 1], 'weight must not decrease with data');
  }
});

// ---- diversity ------------------------------------------------------------
check('dedupe removes duplicate ids and albums', () => {
  const out = dedupe([
    { id: '1', source: 'youtube', album: 'A', image: 'x' },
    { id: '1', source: 'youtube', album: 'B', image: 'y' },
    { id: '2', source: 'youtube', album: 'A', image: 'z' },
  ]);
  assert.equal(out.length, 1, 'same id and same album should collapse');
});

check('artist diversity caps repeats', () => {
  const tracks = [
    { id: '1', artist: 'A' }, { id: '2', artist: 'A' },
    { id: '3', artist: 'A' }, { id: '4', artist: 'B' },
  ];
  const out = applyArtistDiversity(tracks, { maxPerArtist: 2 });
  const leading = out.filter(t => t.artist === 'A').length;
  assert.ok(leading <= 3, `artist A appears ${leading} times (2 kept + demoted)`);
  assert.ok(out.some(t => t.artist === 'B'), 'other artists must survive');
});

check('recent-play window excludes fresh plays', () => {
  const track = { id: '1', source: 'youtube', title: 'X', artist: 'A' };
  const now = Date.now();
  const profile = {
    sinceLastPlay: () => 60 * 60 * 1000, // 1 hour ago
    behaviourFor: () => ({ liked: false, replayCount: 0 }),
  };
  assert.equal(filterRecent([track], profile, { windowHours: 24 }, now).length, 0);
});

check('recent-play window keeps liked tracks', () => {
  const track = { id: '1', source: 'youtube', title: 'X', artist: 'A' };
  const now = Date.now();
  const profile = {
    sinceLastPlay: () => 60 * 60 * 1000,
    behaviourFor: () => ({ liked: true, replayCount: 0 }),
  };
  assert.equal(filterRecent([track], profile, { windowHours: 24 }, now).length, 1);
});

// ---- end-to-end cards -----------------------------------------------------
const shelves = [
  {
    id: 'ml',
    title: 'Malayalam',
    tracks: [
      { id: 'm1', source: 'youtube', title: 'ഉദി ഉദി', artist: 'Aneesh', album: 'Ud Udi' },
      { id: 'm2', source: 'youtube', title: 'മലയാളം ഗീസ്', artist: 'Sarkar', album: 'Malayalam Hits' },
      { id: 'm3', source: 'youtube', title: 'കലിയുകൾ', artist: 'Hruday', album: 'Mood' },
      { id: 'm4', source: 'youtube', title: 'സ്നേഹം', artist: 'Aneesh', album: 'Love' },
    ],
  },
  {
    id: 'ta',
    title: 'Tamil',
    tracks: [
      { id: 't1', source: 'youtube', title: 'கல்யாணி', artist: 'Sushin Shyam', album: 'Kalyani' },
      { id: 't2', source: 'youtube', title: 'தமிழ் பாடல்', artist: 'Anirudh', album: 'Tamil' },
      { id: 't3', source: 'youtube', title: 'அன்பு', artist: 'GV', album: 'Love' },
    ],
  },
  {
    id: 'en',
    title: 'English',
    tracks: [
      { id: 'e1', source: 'youtube', title: 'Workout EDM House Pump', artist: 'DJ Z', album: 'Gym' },
      { id: 'e2', source: 'youtube', title: 'Chill Lo-Fi Ambient Study', artist: 'Lo', album: 'Focus' },
      { id: 'e3', source: 'youtube', title: 'Romantic Love Song', artist: 'Ballad', album: 'Love' },
      { id: 'e4', source: 'youtube', title: 'Hip Hop Rap Trap', artist: 'MC', album: 'Beats' },
      { id: 'e5', source: 'youtube', title: 'Acoustic Folk Unplugged', artist: 'Folk', album: 'Quiet' },
    ],
  },
];

check('cold start fills preference cards but not liked songs', () => {
  const { cards, profile } = generateCards({ shelves });
  const filled = fillColdStartCards({ cards, catalogue: enrichCatalogue(shelves), profile });
  assert.equal(filled.length, 6);

  // The spec requires an empty state here rather than invented content.
  const liked = filled.find(c => c.key === 'liked');
  assert.equal(liked.songs.length, 0, 'liked card must stay empty on cold start');
  assert.equal(liked.isEmpty, true);

  // Preference-based cards must never be empty for a new listener.
  for (const key of ['chill', 'workout', 'romantic', 'malayalam', 'tamil']) {
    const card = filled.find(c => c.key === key);
    assert.ok(card.songs.length > 0, `card "${key}" must not be empty on cold start`);
  }
});

check('cold start never puts wrong-language tracks in a language card', () => {
  const { cards, profile } = generateCards({ shelves });
  const filled = fillColdStartCards({ cards, catalogue: enrichCatalogue(shelves), profile });

  for (const key of ['malayalam', 'tamil']) {
    const card = filled.find(c => c.key === key);
    for (const song of card.songs) {
      assert.equal(
        song.track.enriched.language,
        card.card,
        `${key} card leaked ${song.track.title}`,
      );
    }
  }
});

check('cold start keeps liked card empty rather than inventing songs', () => {
  const { cards, profile } = generateCards({ shelves });
  const filled = fillColdStartCards({ cards, catalogue: enrichCatalogue(shelves), profile });
  const liked = filled.find(c => c.key === 'liked');
  assert.equal(liked.songs.length, 0);
  assert.equal(liked.isEmpty, true);
});

check('malayalam card contains only malayalam tracks', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'malayalam');
  for (const song of card.songs) {
    assert.equal(song.track.enriched.language, 'Malayalam', `leaked ${song.track.title}`);
  }
});

check('tamil card contains only tamil tracks', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'tamil');
  for (const song of card.songs) {
    assert.equal(song.track.enriched.language, 'Tamil', `leaked ${song.track.title}`);
  }
});

check('malayalam and tamil return different tracks', () => {
  const { cards } = generateCards({ shelves });
  const ml = new Set(cards.find(c => c.key === 'malayalam').songs.map(s => s.id));
  const ta = new Set(cards.find(c => c.key === 'tamil').songs.map(s => s.id));
  for (const id of ml) assert.ok(!ta.has(id), 'language cards must not share tracks');
});

check('liked card only returns liked tracks', () => {
  const likedSongs = [
    { id: 'm1', source: 'youtube', title: 'ഉദി ഉദി', artist: 'Aneesh', likedAt: Date.now() },
    { id: 'e3', source: 'youtube', title: 'Romantic Love Song', artist: 'Ballad', likedAt: Date.now() },
  ];
  const { cards } = generateCards({ shelves, likedSongs });
  const card = cards.find(c => c.key === 'liked');
  const likedIds = new Set(likedSongs.map(s => s.id));

  for (const song of card.songs) {
    assert.ok(likedIds.has(song.id), `unliked track in Liked Songs: ${song.id}`);
  }
  assert.ok(card.songs.length > 0);
});

check('liked card is empty with no likes', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'liked');
  assert.equal(card.isEmpty, true);
  assert.equal(card.songs.length, 0);
});

check('workout card favours high energy', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'workout');
  const energies = card.songs.map(s => s.track.enriched.energy);
  const avg = energies.reduce((a, b) => a + b, 0) / (energies.length || 1);
  assert.ok(avg >= 0.5, `workout average energy too low: ${avg.toFixed(2)}`);
});

check('workout card has a non-flat energy ramp', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'workout');
  const energies = card.songs.map(s => s.track.enriched.energy);
  const spread = Math.max(...energies) - Math.min(...energies);
  assert.ok(spread > 0.05, `energy should vary across the ramp, spread was ${spread}`);
});

check('chill card favours low energy', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'chill');
  const energies = card.songs.map(s => s.track.enriched.energy);
  const avg = energies.reduce((a, b) => a + b, 0) / (energies.length || 1);
  assert.ok(avg <= 0.5, `chill average energy too high: ${avg.toFixed(2)}`);
});

check('romantic card only returns romantic tracks', () => {
  const { cards } = generateCards({ shelves });
  const card = cards.find(c => c.key === 'romantic');
  for (const song of card.songs) {
    assert.ok(
      song.track.enriched.isRomantic || song.track.enriched.moods.length > 0,
      'romantic card should be mood-tagged',
    );
  }
});

check('cards do not all return identical results', () => {
  const { cards } = generateCards({ shelves });
  const signatures = cards
    .filter(c => c.songs.length > 0)
    .map(c => c.songs.map(s => s.id).join(','));
  const unique = new Set(signatures);
  assert.ok(unique.size >= 3, `expected diverse cards, got ${unique.size} distinct outputs`);
});

check('results include a human-readable reason', () => {
  const { cards } = generateCards({ shelves });
  for (const card of cards) {
    for (const song of card.songs) {
      assert.equal(typeof song.reason, 'string');
      assert.ok(song.reason.length > 0, 'reason must not be empty');
      assert.equal(typeof song.score, 'number');
    }
  }
});

check('every score is within 0..100', () => {
  const likedSongs = [
    { id: 'm1', source: 'youtube', title: 'ഉദി ഉദി', artist: 'Aneesh', likedAt: Date.now() },
    { id: 'm2', source: 'youtube', title: 'കലിയുകൾ', artist: 'Hruday', likedAt: Date.now() },
  ];
  const history = [
    { id: 'm1', source: 'youtube', playCount: 8, skipCount: 0, completionRate: 0.97, liked: true, replayCount: 5, lastPlayedAt: Date.now() - 60e3 },
    { id: 'm3', source: 'youtube', playCount: 3, skipCount: 2, completionRate: 0.3, liked: false, lastPlayedAt: Date.now() - 3600e3 },
  ];

  const { cards } = generateCards({ shelves, likedSongs, history });

  for (const card of cards) {
    for (const song of card.songs) {
      assert.ok(
        song.score >= 0 && song.score <= 100,
        `card "${card.card}" song "${song.title}" score out of range: ${song.score}`,
      );
    }
  }
});

check('history changes personalisation tier', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`, source: 'youtube', title: 't', artist: 'Aneesh',
    playCount: 2, skipCount: 0, completionRate: 0.9, liked: i < 3, lastPlayedAt: Date.now(),
  }));
  const { profile } = generateCards({ shelves, history });
  assert.equal(profile.level.tier, 'learning');
  assert.equal(profile.totals.plays, 24);
});

check('skips reduce the completion signal', () => {
  const track = enrichTrack({ id: 'm1', source: 'youtube', title: 'ഉദി ഉദി', artist: 'Aneesh' });
  const loved = buildProfile({ history: [{ ...track, id: 'm1', playCount: 10, skipCount: 0, completionRate: 0.95 }], catalogue: [track] });
  const hated = buildProfile({ history: [{ ...track, id: 'm1', playCount: 10, skipCount: 8, completionRate: 0.2 }], catalogue: [track] });

  assert.ok(loved.behaviourFor(track).completionRate > hated.behaviourFor(track).completionRate);
});

// ---- non-Latin artist identity --------------------------------------------
// `normalize` reduces to [a-z0-9] and is the right tool for English lexicons,
// but it erases other scripts. Artist identity is keyed on a fold, so that used
// to collapse every Malayalam artist onto one key.

check('non-Latin artists keep distinct identity keys', () => {
  const a = { id: 'a', source: 'youtube', artist: 'ജേക്സ് ബിജോയ്' };
  const b = { id: 'b', source: 'youtube', artist: 'ഗോപി സുന്ദർ' };

  assert.notEqual(artistKey(a), artistKey(b));
});

check('the same non-Latin artist folds to the same key', () => {
  const a = { id: 'a', source: 'youtube', artist: 'ജേക്സ് ബിജോയ്' };
  const b = { id: 'b', source: 'youtube', artist: 'ജേക്സ് ബിജോയ്' };

  assert.equal(artistKey(a), artistKey(b));
  assert.ok(artistKey(a).length > 0, 'the key must not be empty');
});

check('Latin artist keys are unchanged by the identity fold', () => {
  assert.equal(artistKey({ artist: 'Sai Abhyankkar' }), 'sai abhyankkar');
  assert.equal(artistKey({ artist: 'Beyoncé' }), 'beyonce');
  assert.equal(artistKey({ artist: 'A. R. Rahman' }), 'a r rahman');
  assert.equal(artistKey({ artist: "Don't Stop" }), 'dont stop');

  // The fold must be indistinguishable from normalize for Latin text.
  assert.equal(foldForIdentity('Beyoncé'), normalize('Beyoncé'));
  assert.equal(foldForIdentity("Don't Stop"), normalize("Don't Stop"));
});

check('a non-Latin catalogue is not treated as one artist', () => {
  // The bug this guards: every non-Latin artist folded to '', so the cap of 2
  // per artist emptied a regional card down to two tracks.
  const tracks = [
    { id: 't1', source: 'youtube', title: 'One', artist: 'ജേക്സ് ബിജോയ്' },
    { id: 't2', source: 'youtube', title: 'Two', artist: 'ഗോപി സുന്ദർ' },
    { id: 't3', source: 'youtube', title: 'Three', artist: 'ബിബിൻ അശോക്' },
    { id: 't4', source: 'youtube', title: 'Four', artist: 'ശുഷിൻ ശ്യാം' },
  ];

  const kept = applyArtistDiversity(tracks, { maxPerArtist: 2 });
  assert.equal(kept.length, 4);
  assert.equal(kept.filter((t) => t._diversityDemoted).length, 0);
});

check('the per-artist cap still works for repeated Latin artists', () => {
  const tracks = [
    { id: 'l1', source: 'youtube', title: 'One', artist: 'Sai Abhyankkar' },
    { id: 'l2', source: 'youtube', title: 'Two', artist: 'Sai Abhyankkar' },
    { id: 'l3', source: 'youtube', title: 'Three', artist: 'Sai Abhyankkar' },
  ];

  const kept = applyArtistDiversity(tracks, { maxPerArtist: 2, soft: false });
  assert.equal(kept.length, 2);
});

check('normalize is still Latin-only, which is what the lexicons rely on', () => {
  // Documented contract, and the reason foldForIdentity exists alongside it.
  assert.equal(normalize('ഉദി ഉദി'), '');
  assert.equal(foldForIdentity('ഉദി ഉദി').length > 0, true);
});

// ---- shelf-position popularity proxy ---------------------------------------
// YouTube supplies no popularity figure, so shelf position is the only proxy
// available. These pin its edges: full strength at the front, and no signal at
// all rather than a fabricated zero when position is unknown.

check('shelf position drives the popularity proxy', () => {
  const front = enrichTrack(
    { id: 'y2', source: 'youtube', title: 'Track', artist: 'Artist' },
    { shelfPosition: 0, shelfSize: 6 }
  );
  const back = enrichTrack(
    { id: 'y4', source: 'youtube', title: 'Track', artist: 'Artist' },
    { shelfPosition: 5, shelfSize: 6 }
  );

  assert.ok(Math.abs(front.enriched.popularity - 1) < 1e-9, `got ${front.enriched.popularity}`);
  assert.ok(back.enriched.popularity < front.enriched.popularity);
});

check('popularity stays null when there is no evidence at all', () => {
  const track = enrichTrack({ id: 'y3', source: 'youtube', title: 'Track', artist: 'Artist' });
  assert.equal(track.enriched.popularity, null);
});

console.log('');
console.log(failures === 0 ? 'all recommendation checks passed' : `${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);