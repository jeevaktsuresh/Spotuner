/**
 * Render smoke test.
 *
 * The production build only proves modules *parse*. A component that throws on
 * render — a missing import, a bad prop dereference, an undefined helper —
 * still bundles cleanly and blanks the page at runtime. This mounts every
 * component through react-dom/server so such failures surface as a non-zero
 * exit instead of a black screen.
 *
 * Run: node scripts/render-smoke.mjs
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';

import SpotunerBrand from '../src/components/Branding/SpotunerBrand.jsx';
import SectionHeading from '../src/components/Layout/SectionHeading.jsx';
import Shelf from '../src/components/Layout/Shelf.jsx';
import Artwork from '../src/components/Artwork/Artwork.jsx';
import PlayButton from '../src/components/Artwork/PlayButton.jsx';
import QuickCard from '../src/components/Cards/QuickCard.jsx';
import MediaCard from '../src/components/Cards/MediaCard.jsx';
import WideCard from '../src/components/Cards/WideCard.jsx';
import RankedCard from '../src/components/Cards/RankedCard.jsx';
import HeroCard from '../src/components/Cards/HeroCard.jsx';
import SquareLockup from '../src/components/Cards/SquareLockup.jsx';
import TrackCard from '../src/components/Cards/TrackCard.jsx';
import TrackLockup from '../src/components/Cards/TrackLockup.jsx';
import TrackRow from '../src/components/Cards/TrackRow.jsx';
import HeroCarousel from '../src/components/Cards/HeroCarousel.jsx';

const track = {
  id: 'abc123',
  source: 'youtube',
  title: 'Udi Udi',
  artist: 'Aneesh & Sarkar & Hruday',
  image: 'https://example.invalid/art.jpg',
  duration: 214,
};

const noop = () => {};

const cases = [
  ['SpotunerBrand', () => h(SpotunerBrand)],
  ['SectionHeading', () => h(SectionHeading, { title: 'Recently Played', seeAllTo: '/library' })],
  ['SectionHeading (no action)', () => h(SectionHeading, { title: 'Plain' })],
  ['Shelf', () => h(Shelf, { title: 'New Releases', seeAllTo: '/browse' }, h(SquareLockup, { ...track }))],
  ['Shelf (no title)', () => h(Shelf, null, h(SquareLockup, { ...track }))],
  ['Artwork', () => h(Artwork, { src: track.image, alt: 'a' })],
  ['Artwork (no src)', () => h(Artwork, {})],
  ['PlayButton (standard)', () => h(PlayButton, { onPlay: noop })],
  ['PlayButton (platter)', () => h(PlayButton, { variant: 'platter', onPlay: noop })],
  ['QuickCard', () => h(QuickCard, { ...track, onPlay: noop })],
  ['QuickCard (no subtitle)', () => h(QuickCard, { title: 'x', onPlay: noop })],
  ['MediaCard', () => h(MediaCard, { ...track, onPlay: noop })],
  ['WideCard', () => h(WideCard, { ...track, onPlay: noop })],
  ['RankedCard', () => h(RankedCard, { ...track, rank: 1, onPlay: noop })],
  ['HeroCard', () => h(HeroCard, { ...track, description: 'x', onPlay: noop, onAdd: noop })],
  ['SquareLockup', () => h(SquareLockup, { ...track, onPlay: noop })],
  ['SquareLockup (fluid)', () => h(SquareLockup, { ...track, fluid: true, onPlay: noop })],
  ['TrackCard', () => h(TrackCard, { track, onPlay: noop })],
  ['TrackLockup', () => h(TrackLockup, { ...track, onPlay: noop })],
  ['TrackRow', () => h(TrackRow, { track, index: 0, onPlay: noop })],
  ['HeroCarousel', () => h(HeroCarousel, { slides: [{ key: 'k1', ...track, isArtworkOnly: true, background: '#111' }], onPlay: noop, onSave: noop })],
  ['HeroCarousel (empty slides)', () => h(HeroCarousel, { slides: [], onPlay: noop, onSave: noop })],
  ['HeroCarousel (gradient only)', () => h(HeroCarousel, { slides: [{ key: 'k2', title: 'T', background: 'linear-gradient(#000,#111)' }], onPlay: noop, onSave: noop })],
];

let failures = 0;

for (const [name, render] of cases) {
  try {
    const html = renderToStaticMarkup(h(MemoryRouter, null, render()));
    if (typeof html !== 'string') throw new Error('no markup produced');
    console.log(`ok    ${name.padEnd(28)} ${html.length} chars`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${name.padEnd(28)} ${error.message}`);
  }
}

console.log('');
console.log(failures === 0 ? `all ${cases.length} components rendered` : `${failures} of ${cases.length} failed to render`);
process.exit(failures === 0 ? 0 : 1);