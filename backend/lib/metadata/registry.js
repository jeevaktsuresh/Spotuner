/**
 * Metadata provider registry.
 *
 * Holds the set of providers and decides which ones contribute. A provider is
 * anything exposing:
 *
 *   name            string
 *   isAvailable()   boolean
 *   search(q, n, opts)      -> canonical tracks   (discovery sources only)
 *   getTrack(ref)           -> canonical track    (enrichment)
 *   getTracks(refs)         -> canonical tracks   (enrichment, batch)
 *   getArtist(name)         -> canonical artist
 *   getAlbum(name)          -> canonical album
 *
 * Two distinct roles, deliberately not interchangeable:
 *
 *   PRIMARY    YouTube. The only provider allowed to *produce candidates*.
 *   ENRICHER   MusicBrainz. May only add metadata to a candidate that already
 *              exists, never introduce one.
 *
 * That asymmetry is what stops an enrichment outage, or a bad match, from
 * changing what the homepage shows.
 *
 * Adding a provider is a one-line registration; nothing else in the codebase
 * changes.
 */

import * as youtube from './providers/youtube.js';
import * as musicbrainz from './providers/musicbrainz.js';
import * as spotify from './providers/spotify.js';
import { envNum } from '../runtime/env.js';

/** @type {Record<string, object>} */
const providers = {
  youtube,
  spotify,
  musicbrainz,
};

/** Which providers may generate new candidate tracks. */
const PRIMARY = ['youtube'];

/**
 * Which providers may only enrich candidates. Order is priority order.
 *
 * Spotify is an enricher, never a primary. That is not a temporary limitation: the
 * Spotify Web API serves no audio and its search reflects Spotify's own catalogue,
 * which would let a third party decide what this app shows. Spotify contributes
 * release dates, ISRCs, album names and identifiers; YouTube decides what plays.
 */
const ENRICHERS = ['musicbrainz', 'spotify'];

/**
 * Enrichers consulted per track, per discovery run.
 *
 * Two by default: MusicBrainz and Spotify both contribute metadata YouTube lacks,
 * and they cost very differently. MusicBrainz is rate-limited to roughly one
 * request per second and dominates the run's duration; Spotify is a single fast
 * call per track. Raising this trades discovery latency for metadata depth, so it
 * is configuration rather than a hardcoded count.
 */
const MAX_ENRICHERS = () => envNum('SPOTUNER_MAX_ENRICHERS', 2);

function available(name) {
  const provider = providers[name];
  if (!provider) return null;
  try {
    return provider.isAvailable() ? provider : null;
  } catch {
    // A provider that throws while declaring itself available is treated as down.
    return null;
  }
}

export function getProvider(name) {
  return available(name) ?? null;
}

export function primaryProviders() {
  return PRIMARY.map(available).filter(Boolean);
}

export function enricherProviders() {
  return ENRICHERS.map(available).filter(Boolean).slice(0, MAX_ENRICHERS());
}

/** Registered provider names, for the status route. */
export function providerNames() {
  return {
    registered: Object.keys(providers),
    primary: PRIMARY,
    enrichers: ENRICHERS,
    available: {
      primary: PRIMARY.filter((n) => Boolean(available(n))),
      enrichers: ENRICHERS.filter((n) => Boolean(available(n))),
    },
  };
}

/** Aggregate cache/probe statistics across every provider that exposes them. */
export function providerStats() {
  const out = {};
  for (const [name, provider] of Object.entries(providers)) {
    if (typeof provider.cacheStats === 'function') out[name] = provider.cacheStats();
  }
  return out;
}

export function clearCaches() {
  for (const provider of Object.values(providers)) {
    if (typeof provider.clearCache === 'function') provider.clearCache();
  }
}

export { youtube, musicbrainz };
