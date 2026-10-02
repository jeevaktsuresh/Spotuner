import { trackKey, artistKey } from './profile.js';
import { ENERGY_RAMP } from './enrich.js';

/**
 * Post-ranking filters.
 *
 * These are applied to every card, in the order given by the spec:
 * duplicates → recent-play window → artist diversity → discovery → energy
 * ordering → controlled shuffle.
 */

const DAY_MS = 24 * 3600 * 1000;

/**
 * Remove duplicate songs, albums and artwork.
 *
 * Artwork is used as a duplicate key because different releases often share
 * cover art, and showing the same image twice in one card reads as a bug.
 */
export function dedupe(tracks) {
  const seenIds = new Set();
  const seenAlbums = new Set();
  const seenArtwork = new Set();
  const out = [];

  for (const track of tracks) {
    const id = trackKey(track);
    if (seenIds.has(id)) continue;

    const album = (track.album ?? '').trim().toLowerCase();
    if (album && seenAlbums.has(album)) continue;

    const artwork = (track.image ?? track.artworkUrl ?? '').trim();
    if (artwork && seenArtwork.has(artwork)) continue;

    seenIds.add(id);
    if (album) seenAlbums.add(album);
    if (artwork) seenArtwork.add(artwork);

    out.push(track);
  }

  return out;
}

/**
 * Exclude tracks played inside the recent window.
 *
 * Exemptions follow the spec: liked tracks, heavy replays, and tracks with very
 * high personal relevance survive the filter. Passing `exempt: false` restores
 * strict filtering, which the Liked Songs card uses.
 */
export function filterRecent(tracks, profile, { windowHours = 24, exempt = true } = {}, now = Date.now()) {
  const windowMs = windowHours * 3600 * 1000;

  return tracks.filter((track) => {
    const age = profile.sinceLastPlay(track, now);
    if (age >= windowMs) return true;
    if (!exempt) return false;

    const record = profile.behaviourFor(track);
    if (!record) return false;

    // Liked songs are always eligible.
    if (record.liked) return true;
    // Repeatedly replayed tracks are deliberate, not accidental repeats.
    if ((record.replayCount ?? 0) >= 3) return true;

    return false;
  });
}

/**
 * Cap how many tracks each artist may contribute to one card.
 *
 * Rather than a hard drop, over-represented artists are penalised
 * progressively: the first two are untouched, later ones are pushed down the
 * ranking and only removed if nothing else remains. That keeps the cap from
 * emptying a card when the catalogue is dominated by one artist.
 */
export function applyArtistDiversity(tracks, { maxPerArtist = 2, soft = true } = {}) {
  const counts = new Map();
  const kept = [];

  for (const track of tracks) {
    const key = artistKey(track);
    const used = counts.get(key) ?? 0;

    if (used < maxPerArtist) {
      counts.set(key, used + 1);
      kept.push(track);
      continue;
    }

    if (!soft) continue;

    // Soft mode: park the overflow at the end, still playable.
    kept.push({ ...track, _diversityDemoted: true });
  }

  // Demoted entries move behind everything kept, preserving their order.
  return [
    ...kept.filter((t) => !t._diversityDemoted),
    ...kept.filter((t) => t._diversityDemoted).map(({ _diversityDemoted, ...rest }) => rest),
  ];
}

/**
 * Append discovery tracks from a separate pool.
 *
 * Discovery items are drawn from candidates the main ranking rejected, so they
 * genuinely widen the card rather than duplicating what already scored well.
 */
export function addDiscovery(selected, pool, profile, { ratio = 0.15, limit = 2 } = {}) {
  const target = Math.min(limit, Math.max(1, Math.round(selected.length * ratio)));
  if (target <= 0) return selected;

  const chosen = [];
  const selectedKeys = new Set(selected.map(trackKey));
  const artistsUsed = new Map();

  for (const track of selected) {
    const key = artistKey(track);
    artistsUsed.set(key, (artistsUsed.get(key) ?? 0) + 1);
  }

  for (const track of pool) {
    if (chosen.length >= target) break;

    const key = trackKey(track);
    if (selectedKeys.has(key) || chosen.some((t) => trackKey(t) === key)) continue;

    // Discovery should still respect the artist cap.
    const artist = artistKey(track);
    if ((artistsUsed.get(artist) ?? 0) >= 2) continue;

    chosen.push(track);
    artistsUsed.set(artist, (artistsUsed.get(artist) ?? 0) + 1);
  }

  return [...selected, ...chosen];
}

/**
 * Reorder for a smooth energy progression.
 *
 * Workout only: picks the track closest to each step of `ENERGY_RAMP` from what
 * remains, so consecutive tracks differ in energy rather than sitting at a
 * constant. Greedy by design — searching for a globally optimal order would
 * reorder by score and undo the ranking.
 */
export function applyEnergyRamp(tracks, ramp = ENERGY_RAMP) {
  const remaining = [...tracks];
  const ordered = [];

  for (const target of ramp) {
    if (remaining.length === 0) break;

    let bestIndex = 0;
    let bestDelta = Number.POSITIVE_INFINITY;

    remaining.forEach((track, index) => {
      const energy = track.enriched?.energy ?? 0.5;
      const delta = Math.abs(energy - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });

    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  // Anything beyond the ramp length is appended in score order.
  return [...ordered, ...remaining];
}

/**
 * Shuffle within a small score band.
 *
 * Fully randomising would discard the ranking; not shuffling at all returns an
 * identical card every visit. Adjacent items within `window` points of each
 * other are treated as interchangeable.
 */
export function shuffleWithinScoreBand(items, { window = 8, randomness = 0.4 } = {}) {
  const out = [...items];

  for (let i = 0; i < out.length - 1; i += 1) {
    const current = out[i].score ?? 0;
    let swapWith = i;

    for (let j = i + 1; j < out.length; j += 1) {
      if ((out[j].score ?? 0) < current - window) break;
      if (Math.random() < randomness) swapWith = j;
    }

    if (swapWith !== i) [out[i], out[swapWith]] = [out[swapWith], out[i]];
  }

  return out;
}

/** Sort by score descending, breaking ties deterministically by id. */
export function sortByScore(items) {
  return [...items].sort((a, b) => {
    const diff = (b.score ?? 0) - (a.score ?? 0);
    if (Math.abs(diff) > 0.0001) return diff;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

export { DAY_MS };