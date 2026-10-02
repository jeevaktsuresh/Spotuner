import { useEffect, useRef, useState } from 'react';
import { musicApi } from '../services/api';

/**
 * useHeroImages — resolves hero images for the Featured carousel.
 *
 * Design goals, in priority order:
 *
 *  1. Never block paint. A deterministic gradient is returned on first render
 *     and each slide upgrades in place as its result arrives.
 *  2. Never render a broken image. A slide without a confident match keeps its
 *     generated gradient rather than showing an unverified image.
 *  3. Never stretch square artwork into a banner. When the backend reports
 *     `isArtworkOnly`, the artwork renders blurred behind a scrim instead.
 *
 * Dominant colours are extracted here rather than server-side because the
 * browser decodes every image format through a canvas with no native
 * dependency — cheaper and correct for JPEG, WebP and PNG alike.
 */

/** Stable key so a slide keeps its identity across re-renders. */
function slideKey(track) {
  return `${track?.source ?? 'yt'}:${track?.id ?? track?.title ?? 'unknown'}`;
}

/** Deterministic placeholder, so slide 0 never flashes an empty box. */
function placeholderGradient(seed) {
  let hash = 0;
  const text = String(seed ?? '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;

  return `linear-gradient(135deg, hsl(${hash} 38% 20%) 0%, hsl(${(hash + 40) % 360} 34% 9%) 55%, #0a090c 100%)`;
}

/**
 * Read dominant colours from a loaded image.
 *
 * Downscales to 32x32 and buckets quantised pixels — fast enough to run after
 * paint, accurate enough to build a matching gradient.
 */
function extractDominantColors(img, maxColors = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  try {
    ctx.drawImage(img, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);

    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] < 128) continue; // ignore transparent pixels

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key);

      if (bucket) {
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        bucket.count += 1;
      } else {
        buckets.set(key, { r, g, b, count: 1 });
      }
    }

    return [...buckets.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, maxColors)
      .map(({ r, g, b, count }) => {
        const hex = (v) => Math.round(v / count).toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(b)}`;
      });
  } catch {
    // A cross-origin image taints the canvas and getImageData throws.
    // Colour extraction is an enhancement, never a requirement.
    return [];
  }
}

/** Build a readable backdrop from the extracted palette. */
function gradientFromColors(colors, fallback) {
  if (!colors || colors.length === 0) return fallback;
  if (colors.length === 1) return `linear-gradient(135deg, ${colors[0]} 0%, #0a090c 100%)`;
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 62%, #0a090c 100%)`;
}

function toRequest(track) {
  return {
    title: track?.title,
    artist: track?.artist,
    album: track?.album,
    songId: track?.id,
    artistId: track?.artistId,
    artworkUrl: track?.image,
  };
}

/**
 * @param {Array} tracks Content to resolve, in slide order.
 * @returns {{slides: Array, loading: boolean}}
 */
export default function useHeroImages(tracks) {
  const [resolved, setResolved] = useState({});
  const [loading, setLoading] = useState(false);
  const imageCacheRef = useRef(new Map());

  // Signature so a new array identity with identical content does not refetch.
  const signature = (tracks ?? []).map(slideKey).join('|');

  useEffect(() => {
    if (!tracks || tracks.length === 0) return undefined;

    let cancelled = false;

    // Paint placeholders immediately; the carousel is never blocked.
    const seed = {};
    for (const track of tracks) {
      const key = slideKey(track);
      seed[key] = {
        key,
        title: track?.title ?? '',
        artist: track?.artist ?? '',
        track,
        imageUrl: null,
        isFallback: true,
        isArtworkOnly: false,
        confidence: 0,
        background: placeholderGradient(key),
        dominantColors: [],
        pending: true,
      };
    }
    setResolved(seed);
    setLoading(true);

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const cached = imageCacheRef.current.get(url);
        if (cached) return resolve(cached);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCacheRef.current.set(url, img);
          resolve(img);
        };
        img.onerror = () => reject(new Error(`image failed: ${url}`));
        img.src = url;
      });
    }

    async function resolve() {
      try {
        const payload = await musicApi.matchHeroImages(tracks.map(toRequest));
        if (cancelled) return;

        const byKey = {};

        payload.results.forEach((result, index) => {
          const track = tracks[index];
          const key = slideKey(track);

          byKey[key] = {
            key,
            title: result.title ?? track?.title ?? '',
            artist: result.artist ?? track?.artist ?? '',
            track,
            imageUrl: result.imageUrl ?? null,
            imageType: result.imageType ?? 'gradient',
            confidence: result.confidence ?? 0,
            tier: result.tier ?? 'low',
            // Square artwork renders blurred, never stretched to fill a banner.
            isArtworkOnly: Boolean(result.isArtworkOnly),
            width: result.width ?? null,
            height: result.height ?? null,
            background: result.background ?? placeholderGradient(key),
            dominantColors: result.dominantColors ?? [],
            pending: false,
          };
        });

        setResolved(byKey);
        setLoading(false);

        // Second pass: refine gradients from the real palette. Runs after the
        // carousel is already on screen, so it never delays first paint.
        const refinements = {};

        for (const [key, slide] of Object.entries(byKey)) {
          if (!slide.imageUrl) continue;

          try {
            const img = await loadImage(slide.imageUrl);
            if (cancelled) return;

            const colors = extractDominantColors(img);
            if (colors.length === 0) continue;

            refinements[key] = {
              dominantColors: colors,
              background: gradientFromColors(colors, slide.background),
            };
          } catch {
            // CORS or network failure: keep the existing gradient.
          }
        }

        if (cancelled || Object.keys(refinements).length === 0) return;

        setResolved((prev) => {
          const next = { ...prev };
          for (const [key, patch] of Object.entries(refinements)) {
            if (next[key]) next[key] = { ...next[key], ...patch };
          }
          return next;
        });

        // Preload the next slide so advancing feels instant.
        const first = byKey[slideKey(tracks[0])];
        if (first?.imageUrl) loadImage(first.imageUrl).catch(() => {});
      } catch (error) {
        console.warn('Hero image matching failed, keeping gradients:', error);
        if (!cancelled) setLoading(false);
      }
    }

    resolve();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const slides = (tracks ?? []).map((track) => resolved[slideKey(track)]).filter(Boolean);

  return { slides, loading };
}