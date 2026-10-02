import { similarity, exactMatch, sameArtist, artistCredited, normalize } from './text.js';

/**
 * Relevance scoring.
 *
 * Each candidate accumulates positive evidence (metadata agreement, image
 * quality) and penalties (metadata contradiction, unusable format), then the
 * raw total is clamped into 0..100. The absolute value is less important than
 * the *ranking*, so the weights only need to order candidates correctly.
 */

/** Weights for positive evidence. */
const W = {
  exactTitle: 30,
  similarTitle: 20,
  exactArtist: 25,
  similarArtist: 15,
  exactAlbum: 20,
  albumId: 30,
  songId: 40,
  official: 15,
  highResolution: 10,
  landscape: 10,
  heroRatio: 10,
};

/** Penalties for contradictions and unusable images. */
const P = {
  differentArtist: -50,
  unrelatedTitle: -40,
  randomStock: -30,
  lowResolution: -20,
  watermarked: -15,
  squareOnly: -10,
  portraitOnly: -10,
};

/** Minimum acceptable width for a hero banner. */
export const MIN_HERO_WIDTH = 1200;
const IDEAL_HERO_WIDTH = 1920;

/** Aspect-ratio bands for hero use. */
const HERO_RATIOS = [
  { min: 2.2, max: 3.2, bonus: W.heroRatio }, // 21:9 ultrawide
  { min: 1.6, max: 2.2, bonus: W.heroRatio }, // 16:9
  { min: 1.3, max: 1.6, bonus: W.heroRatio * 0.6 },
];

const STOCK_HOSTS = ['shutterstock', 'gettyimages', 'istockphoto', 'alamy', 'dreamstime'];

/** Candidate is square (or near-square) artwork. */
function isSquareish(aspect) {
  return aspect >= 0.9 && aspect <= 1.1;
}

function isPortraitish(aspect) {
  return aspect > 0 && aspect < 0.9;
}

/**
 * Score a single candidate against the requested content.
 *
 * @param {object} candidate Provider result.
 * @param {object} metadata  The content being matched.
 * @returns {{score:number, raw:number, reasons:string[], isArtworkOnly:boolean}}
 */
export function scoreCandidate(candidate, metadata) {
  const reasons = [];
  let raw = 0;

  const { title, artist, album, albumId, songId, artistId } = metadata;
  const cTitle = candidate.title ?? '';
  const cArtist = candidate.artist ?? '';
  const cAlbum = candidate.album ?? '';

  // ---- Title evidence ----
  if (cTitle && title) {
    if (exactMatch(cTitle, title)) {
      raw += W.exactTitle;
      reasons.push('exact-title');
    } else {
      const score = similarity(cTitle, title);
      if (score >= 0.75) {
        raw += W.similarTitle;
        reasons.push('similar-title');
      } else if (score < 0.35) {
        raw += P.unrelatedTitle;
        reasons.push('unrelated-title');
      }
    }
  }

  // ---- Artist evidence ----
  if (cArtist && artist) {
    if (exactMatch(cArtist, artist)) {
      raw += W.exactArtist;
      reasons.push('exact-artist');
    } else if (artistCredited(artist, cArtist)) {
      // Requested artist is one of several credited — full credit.
      raw += W.exactArtist;
      reasons.push('credited-artist');
    } else if (sameArtist(cArtist, artist)) {
      raw += W.similarArtist;
      reasons.push('similar-artist');
    } else {
      raw += P.differentArtist;
      reasons.push('different-artist');
    }
  }

  // ---- Album evidence ----
  if (cAlbum && album) {
    if (exactMatch(cAlbum, album)) {
      raw += W.exactAlbum;
      reasons.push('exact-album');
    }
  }

  // ---- Identity evidence: strongest possible signal ----
  if (candidate.songId && songId && candidate.songId === songId) {
    raw += W.songId;
    reasons.push('song-id');
  }
  if (candidate.albumId && albumId && candidate.albumId === albumId) {
    raw += W.albumId;
    reasons.push('album-id');
  }
  if (candidate.artistId && artistId && candidate.artistId === artistId) {
      raw += W.exactArtist;
    reasons.push('artist-id');
  }

  // ---- Source trust ----
  if (candidate.official) {
    raw += W.official;
    reasons.push('official');
  }

  if (candidate.stock) {
    raw += P.randomStock;
    reasons.push('stock');
  }
  if (candidate.watermarked) {
    raw += P.watermarked;
    reasons.push('watermarked');
  }

  // Quality evidence only counts once identity is settled, otherwise a pretty
  // but unrelated image can outscore the correct album cover.
  const identityConfirmed =
    reasons.includes('song-id') ||
    reasons.includes('album-id') ||
    (reasons.includes('exact-title') &&
      (reasons.includes('exact-artist') || reasons.includes('credited-artist')));

  // ---- Image quality ----
  if (candidate.probed?.ok) {
    const { width, height } = candidate.probed;
    const aspect = width / height;

    if (width >= IDEAL_HERO_WIDTH) {
      raw += W.highResolution;
      reasons.push('high-res');
    } else if (width >= MIN_HERO_WIDTH) {
      raw += W.highResolution * 0.7;
      reasons.push('acceptable-res');
    } else {
      raw += P.lowResolution;
      reasons.push('low-res');
    }

    const hero = HERO_RATIOS.find((band) => aspect >= band.min && aspect <= band.max);
    if (hero) {
      raw += hero.bonus;
      reasons.push('hero-ratio');
    } else if (aspect > 1.1) {
      raw += W.landscape;
      reasons.push('landscape');
    } else if (isSquareish(aspect)) {
      // Square art is the norm for music releases. It is not a disqualifier —
      // the renderer applies a blurred treatment — so the shape penalty is
      // waived once the release itself is confirmed.
      if (!identityConfirmed) {
        raw += P.squareOnly;
        reasons.push('square-only');
      }
    } else if (isPortraitish(aspect)) {
      if (!identityConfirmed) {
        raw += P.portraitOnly;
        reasons.push('portrait-only');
      }
    }
  } else if (!identityConfirmed) {
    // Unprobed candidates are assumed square artwork: trustworthy for content
    // identity, unsuitable as a stretched banner.
    raw += P.squareOnly;
    reasons.push('square-only');
  }

  // Query intent nudges ranking between otherwise-equal candidates.
  raw += (candidate.queryWeight ?? 0) * 10;

  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    raw,
    reasons,
    /** Square artwork must be blurred/treated, never stretched. */
    isArtworkOnly: !candidate.probed?.ok || isSquareish(candidate.probed.width / candidate.probed.height),
  };
}

/** Confidence tiers used to decide whether a result may be shown. */
export const CONFIDENCE = {
  HIGH: 90,
  MEDIUM: 70,
};

export function confidenceTier(score) {
  if (score >= CONFIDENCE.HIGH) return 'high';
  if (score >= CONFIDENCE.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Rank candidates, then drop anything below the medium-confidence floor.
 *
 * The floor is what guarantees a poor match degrades to the fallback rather
 * than being displayed as if it were correct.
 */
export function rankCandidates(candidates, metadata, { minScore = CONFIDENCE.MEDIUM } = {}) {
  const scored = candidates
    .filter(Boolean)
    .map((candidate) => ({ ...candidate, ...scoreCandidate(candidate, metadata) }))
    .filter((candidate) => candidate.score >= minScore);

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Pick `count` visually distinct results from a ranked list.
 *
 * Scores within a small band are treated as interchangeable, so a slideshow
 * doesn't show four near-identical covers. Candidates are penalised for
 * repeating an already-chosen image URL.
 */
export function selectDistinct(ranked, count, { similarityWindow = 8 } = {}) {
  const chosen = [];
  const usedUrls = new Set();

  for (const candidate of ranked) {
    if (chosen.length >= count) break;

    if (usedUrls.has(candidate.url)) continue;

    const competesWithBest =
      chosen.length === 0 || chosen[chosen.length - 1].score - candidate.score <= similarityWindow;

    if (chosen.length > 0 && competesWithBest) {
      const tooClose = chosen.every((picked) => {
        const sameContent =
          picked.albumId && candidate.albumId && picked.albumId === candidate.albumId;
        const sameTitle =
          picked.title && candidate.title && exactMatch(picked.title, candidate.title);

        // Same release on purpose (same album, same song) is legitimate reuse.
        return sameContent || sameTitle;
      });

      if (tooClose) continue;
    }

    chosen.push(candidate);
    usedUrls.add(candidate.url);
  }

  return chosen;
}

/** Stable, deterministic fallback gradient for content with no usable image. */
export function fallbackGradient(metadata) {
  const seed = normalize(`${metadata.title ?? ''}${metadata.artist ?? ''}`);

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }

  const hue = hash;
  const secondaryHue = (hue + 40) % 360;

  return {
    type: 'gradient',
    background: `linear-gradient(135deg, hsl(${hue} 42% 22%) 0%, hsl(${secondaryHue} 38% 10%) 55%, #0a090c 100%)`,
    dominantColors: [
      `hsl(${hue} 42% 22%)`,
      `hsl(${secondaryHue} 38% 10%)`,
    ],
  };
}