import { fallbackGradient } from '../score.js';

/**
 * FallbackImageProvider — the guaranteed terminal state.
 *
 * Produces a deterministic gradient derived from the content's own text, so
 * every slide gets a distinct, intentional backdrop rather than a shared grey
 * placeholder or, critically, a broken image.
 *
 * This provider always returns a result: the carousel can never end up empty.
 */
export default {
  name: 'fallback',

  /**
   * Runs last and is never score-filtered, so it returns a single synthetic
   * candidate flagged as `isFallback`.
   */
  async find(metadata) {
    const gradient = fallbackGradient(metadata);

    return [
      {
        url: null,
        imageType: 'gradient',
        source: 'fallback',
        isFallback: true,
        official: false,
        queryWeight: 0,
        title: metadata.title ?? '',
        artist: metadata.artist ?? '',
        album: metadata.album ?? '',
        background: gradient.background,
        dominantColors: gradient.dominantColors,
      },
    ];
  },
};