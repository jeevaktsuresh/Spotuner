import { useEffect, useRef, useState } from 'react';
import { musicApi } from '../services/api';
import { buildProfileSummary } from '../recommend/profileSummary';

/**
 * Loads the personalised "For You" shelf.
 *
 * Caching differs deliberately from `useDiscovery`. That hook caches per scope
 * because the shelf is the same for everyone; this one is personalised, so the
 * browser cache is keyed on a digest of the profile and only reused while the
 * profile is unchanged. Returning a stale personalised shelf after someone skips
 * a few tracks would be visibly wrong.
 *
 * The profile is summarised and sent on each change; nothing is persisted to the
 * backend, so the server never holds anything about who the listener is.
 *
 * @param {object} [options]
 * @param {string} [options.scope]
 * @param {number} [options.limit]
 * @param {Array}  [options.catalogue]  Enriched tracks, used to read tags.
 * @param {boolean}[options.enabled]    Skip the request entirely when false.
 */
export default function useForYou({
  scope = 'global',
  limit = 12,
  catalogue = [],
  likedSongs = [],
  recentlyPlayed = [],
  history = [],
  enabled = true,
} = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cache = useRef({ key: null, value: null, at: 0 });

  // Recomputed whenever library state changes; `buildProfileSummary` is pure and
  // cheap, so this is safe to do on every render.
  const profile = buildProfileSummary({ likedSongs, recentlyPlayed, history, catalogue });

  // A short digest identifies the profile for cache purposes without transmitting
  // anything. Two different listeners must never share a browser-cached shelf.
  const profileKey = profile
    ? `${profile.totalPlays}-${Object.keys(profile.artists).length}-${Object.keys(profile.languages).length}-${profile.artists[Object.keys(profile.artists)[0]] ?? ''}`
    : 'none';

  useEffect(() => {
    if (!enabled || !profile) return undefined;

    let cancelled = false;

    const cacheKey = `${scope}:${limit}:${profileKey}`;
    const cached = cache.current;

    if (cached.key === cacheKey && cached.value && Date.now() - cached.at < 5 * 60 * 1000) {
      setData(cached.value);
      setLoading(false);
      return undefined;
    }

    async function load() {
      setLoading(true);
      try {
        const result = await musicApi.getForYou({
          profile,
          scope,
          limit,
          enrich: true,
        });

        if (cancelled) return;

        cache.current = { key: cacheKey, value: result, at: Date.now() };
        setData(result);
        setError(null);
      } catch (err) {
        // A failed personalised shelf is not a broken page: the caller renders
        // trending/latest instead, so this is logged and swallowed.
        console.error('Failed to load For You shelf:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [scope, limit, profileKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // With no listening data there is nothing to personalise. That is derived during
  // render rather than pushed through an effect, so a cold listener renders the
  // caller's fallback shelf immediately instead of flashing an empty state.
  const hasProfile = Boolean(profile);

  return {
    tracks: hasProfile ? data?.tracks ?? [] : [],
    meta: data,
    reasons: new Map((data?.tracks ?? []).map((t) => [`${t.source}:${t.id}`, t.forYouReason])),
    personalised: data?.stats?.personalisation ?? null,
    loading: hasProfile && loading,
    error: hasProfile ? error : null,
    /** True when the backend reports it had enough signal to rank personally. */
    isPersonalised: Boolean(data?.stats?.personalisation?.hasHistory),
    /** False when there is no listening data, so the caller can fall back. */
    hasProfile,
  };
}
