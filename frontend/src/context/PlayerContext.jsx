import { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { Howl } from 'howler';
import { musicApi } from '../services/api';
import { QueueContext } from './QueueContext';
import { useLibrary } from './LibraryContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  /**
   * Which provider actually served the audio currently playing.
   *
   * Separate from `currentTrack.source` because they differ whenever a fallback was
   * used: a Spotify track played through YouTube has source 'spotify' and
   * playbackProvider 'youtube'. null before anything has played.
   */
  const [playbackProvider, setPlaybackProvider] = useState(null);

  const howlRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Safely access queue context - may not be available immediately
  const queueContext = useContext(QueueContext);
  const { next } = queueContext || { next: () => {} };
  const { addToRecentlyPlayed, recordCompletion } = useLibrary();

  // Howler callbacks close over stale state, so the playing track is mirrored
  // into a ref to keep the behavioural records accurate.
  const trackRef = useRef(null);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startProgressTracking = useCallback(() => {
    stopProgressTracking();
    progressIntervalRef.current = setInterval(() => {
      if (howlRef.current) {
        setPosition(howlRef.current.seek());
      }
    }, 100);
  }, [stopProgressTracking]);

  const teardown = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    stopProgressTracking();
  }, [stopProgressTracking]);

  /** Play a progressive audio file through Howler. */
  const playProgressive = useCallback(
    (src, startVolume) => {
      return new Promise((resolve, reject) => {
        const howl = new Howl({
          src: [src],
          html5: true,
          format: ['mp3', 'm4a', 'webm', 'aac'],
          volume: startVolume,
          onload: () => {
            setDuration(howl.duration());
            setIsLoading(false);
            resolve();
          },
          onloaderror: (_id, error) => reject(error),
          onplay: () => {
            setIsPlaying(true);
            startProgressTracking();
          },
          onpause: () => {
            setIsPlaying(false);
            stopProgressTracking();
          },
          onend: () => {
            setIsPlaying(false);
            stopProgressTracking();
            // Reaching the end means the listener heard the whole track, which
            // is the strongest positive signal the recommender has.
            if (trackRef.current) {
              recordCompletion(trackRef.current, howl.duration(), true);
            }
            next();
          },
          onplayerror: (_id, error) => reject(error),
        });

        howlRef.current = howl;
        howl.play();
      });
    },
    [next, startProgressTracking, stopProgressTracking]
  );

  /**
   * Resolve a stream URL for a track, whatever provider it came from.
   *
   * Tries the track's own provider first — which is a no-op for YouTube and the
   * existing fast path is preserved verbatim — then falls back to the provider-aware
   * endpoint. A Spotify-sourced track has no audio of its own, so the fallback is
   * what makes it playable at all.
   *
   * @returns {Promise<{streamUrl: string, source: string}>}
   */
  const resolveStream = useCallback(async (track) => {
    // Fast path: YouTube tracks resolve directly, exactly as they always have.
    if (track.source === 'youtube') {
      const { streamUrl } = await musicApi.getStreamUrl('youtube', track.id);
      return { streamUrl, source: 'youtube' };
    }

    // Any other provider has no stream endpoint of its own, so ask the backend to
    // find a playable counterpart. It reports which provider actually served it.
    const resolved = await musicApi.resolvePlayable(track.source, track.id);
    if (!resolved?.streamUrl) {
      throw new Error(`No playable source for ${track.source} track`);
    }
    return { streamUrl: resolved.streamUrl, source: resolved.source };
  }, []);

  // Load and play track
  async function playTrack(track) {
    teardown();

    setIsLoading(true);
    setCurrentTrack(track);
    setPosition(0);
    setDuration(0);
    trackRef.current = track;

    try {
      const { streamUrl, source } = await resolveStream(track);

      await playProgressive(streamUrl, volume);

      // Record which provider actually served the audio, so the UI can show it and
      // so a track played via a fallback is not mistaken for its own provider.
      setPlaybackProvider(source);

      // Add to recently played
      addToRecentlyPlayed(track);
    } catch (error) {
      console.error('Failed to play track:', error);
      setIsLoading(false);
      setIsPlaying(false);
      // Try next track
      next();
    }
  }

  function play() {
    howlRef.current?.play();
  }

  function pause() {
    howlRef.current?.pause();

    // Pausing is not the same as skipping: only the latter counts against a
    // track, and only once the listener has moved well past the opening.
    const howl = howlRef.current;
    if (howl && trackRef.current) {
      const heard = howl.seek();
      const total = howl.duration();
      if (total && heard / total > 0.25) {
        recordCompletion(trackRef.current, heard, false);
      }
    }
  }

  function seek(seconds) {
    howlRef.current?.seek(seconds);
    setPosition(seconds);
  }

  function changeVolume(value) {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    howlRef.current?.volume(clamped);
    localStorage.setItem('volume', clamped);
  }

  // Load saved volume
  useEffect(() => {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      setVolume(parseFloat(savedVolume));
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isLoading,
        volume,
        position,
        duration,
        /** Provider that actually served the audio; may differ from the track's source. */
        playbackProvider,
        playTrack,
        play,
        pause,
        seek,
        changeVolume,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};
