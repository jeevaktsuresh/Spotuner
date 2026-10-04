import { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { Howl } from 'howler';
import { musicApi } from '../services/api';
import { QueueContext, stepIndex, NO_INDEX } from './QueueContext';
import { useLibrary } from './LibraryContext';

const PlayerContext = createContext();

/**
 * Turn a thrown value into something worth showing a listener.
 *
 * The API client either rejects with a message string or with a raw axios
 * error, and `resolveStream` throws a plain `Error` for a track with no
 * playable counterpart. All three are useless raw, so each is mapped to a short
 * headline plus the underlying reason, which is kept because "it didn't work" is
 * not something anyone can act on.
 */
function describePlaybackFailure(error, track) {
  const title = track?.title ? `“${track.title}”` : 'that track';
  const reason =
    (typeof error === 'string' && error) ||
    error?.message ||
    (error?.response?.data?.error ?? null);

  return {
    message: `Couldn't play ${title}`,
    hint: reason ? String(reason) : 'No playable source was found for this track.',
  };
}

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

  /**
   * The last playback failure, or null.
   *
   * Previously a failed load was logged and the player quietly moved on, so a
   * track that could not be resolved looked identical to one that had finished.
   * Nothing is silenced now: the message is held here until the listener
   * dismisses it or a new track starts.
   */
  const [playbackError, setPlaybackError] = useState(null);

  const howlRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Safely access queue context - may not be available immediately
  const queueContext = useContext(QueueContext);
  const {
    queue = [],
    currentIndex = 0,
    repeat = 'off',
    setCurrentIndex,
    seatIndexFor,
  } = queueContext || {};
  const { addToRecentlyPlayed, recordCompletion } = useLibrary();

  // Howler callbacks close over stale state, so the playing track is mirrored
  // into a ref to keep the behavioural records accurate.
  const trackRef = useRef(null);

  /**
   * Live mirrors of everything a Howler callback needs.
   *
   * A Howl is constructed once per track and its `onend` keeps the closure it was
   * built with. Ten skips later that closure would still read the queue position
   * from the render in which the track started, which is why auto-advance read
   * the wrong index and, before that, why it read one at all while never being
   * wired to playback.
   *
   * They are mirrored in an effect rather than during render: a Howler callback
   * only ever fires from a media event or a click, both of which happen after
   * commit, so the mirrors are never a render behind.
   */
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const repeatRef = useRef(repeat);
  const volumeRef = useRef(volume);
  const recordCompletionRef = useRef(recordCompletion);
  const playTrackRef = useRef(null);

  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = currentIndex;
    repeatRef.current = repeat;
    volumeRef.current = volume;
    recordCompletionRef.current = recordCompletion;
  }, [queue, currentIndex, repeat, volume, recordCompletion]);

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
    (src, startVolume, onEnded) => {
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
              recordCompletionRef.current(trackRef.current, howl.duration(), true);
            }
            onEnded();
          },
          onplayerror: (_id, error) => reject(error),
        });

        howlRef.current = howl;
        howl.play();
      });
    },
    [startProgressTracking, stopProgressTracking]
  );

  /**
   * Resolve a source the player can actually load.
   *
   * Returns an API-hosted audio URL rather than the signed googlevideo link. The
   * provider is still resolved server-side, so a Spotify-sourced track keeps working
   * by being matched to a YouTube upload — only the final hop changes, from a
   * cross-origin CDN URL to this API. That hop was the failure: the API call
   * returned 200 with a valid-looking `streamUrl`, and then the browser's media
   * request to googlevideo transferred nothing.
   *
   * @returns {Promise<{streamUrl: string, source: string}>}
   */
  const resolveStream = useCallback(async (track) => {
    // Fast path: YouTube tracks resolve directly, exactly as they always have.
    if (track.source === 'youtube') {
      return { streamUrl: musicApi.getAudioUrl('youtube', track.id), source: 'youtube' };
    }

    // Any other provider has no stream endpoint of its own, so ask the backend to
    // find a playable counterpart. It reports which provider actually served it.
    const resolved = await musicApi.resolvePlayable(track.source, track.id);
    if (!resolved?.streamUrl) {
      throw new Error(`No playable source for ${track.source} track`);
    }
    return {
      // `track.id` is the matched upload's id on whichever provider won, which is
      // the id the audio endpoint has to be asked for — not the Spotify id the
      // listener clicked.
      streamUrl: musicApi.getAudioUrl(resolved.source, resolved.track?.id ?? track.id),
      source: resolved.source,
    };
  }, []);

  /**
   * Move the queue position and start whatever it lands on.
   *
   * One path for both the transport buttons and auto-advance, so a skip from the
   * PlayerBar and a skip because a track ended cannot drift apart. Returns false
   * when the queue has nowhere to go, which is the end of the list with repeat
   * off — a normal stop, not a failure.
   *
   * Declared before `playTrack` and reached through `playTrackRef`, which keeps
   * the two mutually recursive steps from needing each other in a dep array.
   */
  const advance = useCallback(
    (direction) => {
      const list = queueRef.current;
      const target = stepIndex(list, indexRef.current, repeatRef.current, direction);

      if (target === NO_INDEX) return false;

      const landing = list[target];
      if (!landing) return false;

      // Seated before the play call so a second skip in the same tick steps from
      // the new position rather than re-deriving the old one.
      indexRef.current = target;
      setCurrentIndex(target);

      playTrackRef.current(landing);
      return true;
    },
    [setCurrentIndex]
  );

  /**
   * What happens when a track reaches its end.
   *
   * This is the auto-advance. Repeat-one replays the same audio rather than
   * re-resolving it, so looping costs no request. Otherwise the queue advances,
   * and an exhausted queue with repeat off simply stops — which is why this never
   * reports an error.
   *
   * Stable across renders: `advance` is stable because the only thing it depends
   * on is a state setter, so a Howl built early still holds a current callback.
   */
  const handleTrackEnd = useCallback(() => {
    if (repeatRef.current === 'track') {
      howlRef.current?.seek(0);
      howlRef.current?.play();
      return;
    }

    advance(1);
  }, [advance]);

  // Load and play track
  const playTrack = useCallback(
    async (track) => {
      if (!track?.id) return;

      teardown();

      setIsLoading(true);
      // A new attempt clears the previous failure rather than stacking a second
      // toast behind it.
      setPlaybackError(null);
      setCurrentTrack(track);
      setPosition(0);
      setDuration(0);
      trackRef.current = track;

      // Seat the queue position on the track being started.
      //
      // Every shelf replaces the queue and then asks for one of its tracks, but
      // nothing told the queue which one. The index therefore kept whatever value
      // the previous list left behind, so the up-next list highlighted the wrong
      // row and Previous was dead.
      //
      // `seatIndexFor` is asked rather than scanning a mirrored queue, because a
      // shelf calls `setQueue(items)` and `playTrack(item)` in the same handler —
      // at that point React has not committed the new queue yet.
      const seat = seatIndexFor ? seatIndexFor(track) : -1;
      if (seat !== -1 && seat !== indexRef.current) {
        indexRef.current = seat;
        setCurrentIndex(seat);
      }

      try {
        const { streamUrl, source } = await resolveStream(track);

        await playProgressive(streamUrl, volumeRef.current, handleTrackEnd);

        // Record which provider actually served the audio, so the UI can show it and
        // so a track played via a fallback is not mistaken for its own provider.
        setPlaybackProvider(source);

        // Add to recently played
        addToRecentlyPlayed(track);
      } catch (error) {
        console.error('Failed to play track:', error);
        setIsLoading(false);
        setIsPlaying(false);
        // Surfaced rather than swallowed: the old behaviour called `next()` here,
        // which moved the queue on without playing anything and left the listener
        // with silence and no explanation.
        setPlaybackError(describePlaybackFailure(error, track));
      }
    },
    [
      teardown,
      resolveStream,
      playProgressive,
      handleTrackEnd,
      addToRecentlyPlayed,
      setCurrentIndex,
      seatIndexFor,
    ]
  );

  // `advance` and `playQueueIndex` are stable callbacks that must reach the
  // current `playTrack` without depending on it, which would otherwise be a
  // dependency cycle: playTrack depends on handleTrackEnd, which depends on
  // advance. The ref breaks it and keeps both of them referentially stable.
  useEffect(() => {
    playTrackRef.current = playTrack;
  }, [playTrack]);

  const next = useCallback(() => advance(1), [advance]);
  const previous = useCallback(() => advance(-1), [advance]);

  /** Play a specific queue row, keeping the queue position in step with it. */
  const playQueueIndex = useCallback(
    (index) => {
      const track = queueRef.current[index];
      if (!track) return;

      indexRef.current = index;
      setCurrentIndex(index);
      playTrackRef.current(track);
    },
    [setCurrentIndex]
  );

  function play() {
    const howl = howlRef.current;
    if (!howl) return;

    // Howler resumes from the playhead, and a finished track is left sitting at
    // its own duration — so pressing play after a track ends re-fires `onend`
    // instead of playing anything. Rewind first.
    const total = howl.duration();
    if (total && howl.seek() >= total - 0.25) {
      howl.seek(0);
      setPosition(0);
    }

    howl.play();
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
    const howl = howlRef.current;
    if (!howl) return;

    const total = howl.duration();
    const clamped = Math.max(0, total ? Math.min(seconds, total) : seconds);

    howl.seek(clamped);
    setPosition(clamped);
  }

  function changeVolume(value) {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    howlRef.current?.volume(clamped);
    localStorage.setItem('volume', clamped);
  }

  const dismissPlaybackError = useCallback(() => setPlaybackError(null), []);

  // Load saved volume
  useEffect(() => {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      const parsed = parseFloat(savedVolume);
      if (Number.isFinite(parsed)) setVolume(parsed);
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
        /** Last playback failure, or null. Dismissed on retry or a new track. */
        playbackError,
        dismissPlaybackError,
        playTrack,
        /** Skip to the neighbouring track and play it; false at the queue edge. */
        next,
        previous,
        /** Play one queue row by index. */
        playQueueIndex,
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
