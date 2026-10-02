import { createContext, useState, useEffect, useContext } from 'react';

const LibraryContext = createContext();

const STORAGE_KEYS = {
  LIKED_SONGS: 'spotify_liked_songs',
  PLAYLISTS: 'spotify_playlists',
  RECENTLY_PLAYED: 'spotify_recently_played',
  LISTENING_HISTORY: 'spotuner_listening_history',
};

/**
 * Tracks kept per song in the listening history.
 *
 * Capped so localStorage cannot grow without bound — roughly 300 records of
 * this size is a few tens of KB.
 */
const HISTORY_LIMIT = 300;

export function LibraryProvider({ children }) {
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);

  /**
   * Rich per-song behaviour the recommender learns from.
   *
   * `recentlyPlayed` alone cannot express completion or skips, and without
   * those the recommender cannot tell a loved song from one skipped every time.
   * Each record is keyed by `source:id`.
   */
  const [history, setHistory] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const liked = localStorage.getItem(STORAGE_KEYS.LIKED_SONGS);
      const playlists = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      const recent = localStorage.getItem(STORAGE_KEYS.RECENTLY_PLAYED);
      const history = localStorage.getItem(STORAGE_KEYS.LISTENING_HISTORY);

      if (liked) setLikedSongs(JSON.parse(liked));
      if (playlists) setPlaylists(JSON.parse(playlists));
      if (recent) setRecentlyPlayed(JSON.parse(recent));
      if (history) setHistory(JSON.parse(history));
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, []);

  // Save liked songs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(likedSongs));
  }, [likedSongs]);

  // Save playlists to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
  }, [playlists]);

  // Save recently played to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, JSON.stringify(recentlyPlayed));
  }, [recentlyPlayed]);

  // Save listening history to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LISTENING_HISTORY, JSON.stringify(history));
  }, [history]);

  /**
   * Merge a patch into one history record.
   *
   * `patchOrUpdater` may be a function receiving the current record, so callers
   * derive their patch from live state *inside* the updater. Reading `history`
   * directly here would close over a stale render and compute completion rates
   * against outdated counts.
   */
  function patchHistory(track, patchOrUpdater) {
    if (!track?.id) return;

    const key = `${track.source ?? 'yt'}:${track.id}`;

    setHistory(prev => {
      const index = prev.findIndex(r => `${r.source ?? 'yt'}:${r.id}` === key);
      const existing = index >= 0 ? prev[index] : null;

      const base = {
        id: track.id,
        source: track.source ?? 'yt',
        title: track.title,
        artist: track.artist,
        image: track.image,
        duration: track.duration ?? null,
        playCount: 0,
        skipCount: 0,
        replayCount: 0,
        liked: false,
        likedAt: null,
        completionRate: 0,
        lastPlayedAt: null,
        listeningDuration: 0,
        ...existing,
      };

      const patch =
        typeof patchOrUpdater === 'function' ? patchOrUpdater(base) : patchOrUpdater;

      const record = { ...base, ...patch };

      if (index >= 0) {
        const next = [...prev];
        next[index] = record;
        return next;
      }

      return [record, ...prev].slice(0, HISTORY_LIMIT);
    });
  }

  function toggleLike(track) {
    setLikedSongs(prev => {
      const isLiked = prev.some(t => t.id === track.id && t.source === track.source);
      if (isLiked) {
        return prev.filter(t => !(t.id === track.id && t.source === track.source));
      }
      return [...prev, { ...track, likedAt: Date.now() }];
    });

    // A like is the strongest positive signal available, so it is mirrored
    // into the behavioural history the recommender reads.
    const currentlyLiked = likedSongs.some(
      t => t.id === track.id && t.source === track.source,
    );

    patchHistory(track, {
      liked: !currentlyLiked,
      likedAt: currentlyLiked ? null : Date.now(),
    });
  }

  function isLiked(trackId) {
    // Checked against both fields: `toggleLike` matches on id *and* source, so
    // checking id alone would report a like for a different source's track
    // that happens to share the id.
    return likedSongs.some(
      t => t.id === trackId && (t.source === undefined || t.source === 'youtube'),
    );
  }

  function createPlaylist(name, description = '') {
    const newPlaylist = {
      id: Date.now().toString(),
      name,
      description,
      tracks: [],
      createdAt: Date.now(),
      image: null
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    return newPlaylist;
  }

  function deletePlaylist(playlistId) {
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
  }

  function updatePlaylist(playlistId, updates) {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, ...updates } : p
    ));
  }

  function addToPlaylist(playlistId, track) {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const exists = p.tracks.some(t => t.id === track.id && t.source === track.source);
        if (!exists) {
          return { ...p, tracks: [...p.tracks, { ...track, addedAt: Date.now() }] };
        }
      }
      return p;
    }));
  }

  function removeFromPlaylist(playlistId, trackId) {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.id !== trackId) };
      }
      return p;
    }));
  }

  function addToRecentlyPlayed(track) {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(t => !(t.id === track.id && t.source === track.source));
      return [{ ...track, playedAt: Date.now() }, ...filtered].slice(0, 50);
    });

    // Counts are read inside the updater so they are never stale.
    patchHistory(track, existing => ({
      playCount: (existing.playCount ?? 0) + 1,
      lastPlayedAt: Date.now(),
    }));
  }

  /**
   * Record how far a listener actually got.
   *
   * Completion is the strongest signal for distinguishing a song they love
   * from one they tolerate, so it is tracked per play as a running mean.
   * `completed` separates hearing a track through from abandoning it, which the
   * recommender treats very differently.
   */
  function recordCompletion(track, secondsListened, completed) {
    if (!track?.id) return;

    patchHistory(track, existing => {
      const duration = track.duration ?? existing.duration ?? 0;
      if (!duration) return {};

      const ratio = Math.max(0, Math.min(1, secondsListened / duration));
      const plays = Math.max(1, existing.playCount ?? 1);
      const previousRate = existing.completionRate ?? ratio;

      return {
        completionRate: (previousRate * (plays - 1) + ratio) / plays,
        listeningDuration: (existing.listeningDuration ?? 0) + secondsListened,
        skipCount: (existing.skipCount ?? 0) + (completed ? 0 : 1),
      };
    });
  }

  /** Mark an intentional replay, which the recommender treats as strong love. */
  function recordReplay(track) {
    patchHistory(track, existing => ({
      replayCount: (existing.replayCount ?? 0) + 1,
      playCount: (existing.playCount ?? 0) + 1,
      lastPlayedAt: Date.now(),
    }));
  }

  /** Record an explicit skip, independent of completion. */
  function recordSkip(track) {
    patchHistory(track, existing => ({
      skipCount: (existing.skipCount ?? 0) + 1,
    }));
  }

  return (
    <LibraryContext.Provider
      value={{
        likedSongs,
        playlists,
        recentlyPlayed,
        history,
        toggleLike,
        isLiked,
        createPlaylist,
        deletePlaylist,
        updatePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        addToRecentlyPlayed,
        recordCompletion,
        recordReplay,
        recordSkip,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within LibraryProvider');
  }
  return context;
};
