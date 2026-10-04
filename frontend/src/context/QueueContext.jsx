import { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react';

export const QueueContext = createContext();

/** Returned by {@link stepIndex} when the queue has nowhere to go. */
export const NO_INDEX = -1;

/**
 * Where a skip should land, or `NO_INDEX` when the queue cannot move.
 *
 * The single owner of queue-position arithmetic. It is a pure function of
 * `(queue, currentIndex, repeat, direction)` so it can be called both from a
 * click handler and from a Howler `onend` callback that closed over state from
 * an older render — the two callers used to disagree, because each had its own
 * copy of the "am I at the end?" test.
 *
 * `repeat: 'track'` deliberately does **not** affect skipping: Next and Previous
 * always move to the neighbouring track, while looping the current one is
 * decided by the player when a track ends.
 *
 * @param {Array} queue
 * @param {number} currentIndex
 * @param {'off'|'track'|'context'} repeat
 * @param {1|-1} direction
 * @returns {number} target index, or `NO_INDEX`
 */
export function stepIndex(queue, currentIndex, repeat, direction) {
  if (!Array.isArray(queue) || queue.length === 0) return NO_INDEX;

  if (direction > 0) {
    if (currentIndex < queue.length - 1) return currentIndex + 1;
    return repeat === 'context' ? 0 : NO_INDEX;
  }

  return currentIndex > 0 ? currentIndex - 1 : NO_INDEX;
}

export function QueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off' | 'track' | 'context'
  const [originalQueue, setOriginalQueue] = useState([]);

  /**
   * The queue as of the most recent mutation, readable synchronously.
   *
   * Every mutation goes through {@link commitQueue} so this is never a render
   * behind. That matters because a shelf does `setQueue(items)` and then asks for
   * one of those items in the same handler: `PlayerContext` has to be able to ask
   * "where does this track sit in the queue I was just given?" before React has
   * committed the new state.
   */
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  /** Replace the queue, keeping the synchronous mirror in step. */
  function commitQueue(next) {
    const value = typeof next === 'function' ? next(queueRef.current) : next;
    queueRef.current = value;
    setQueue(value);
    return value;
  }

  /**
   * Where `track` sits in the queue right now, or -1 if it is not queued.
   *
   * Read by `PlayerContext.playTrack` so that starting a track also seats the
   * queue position on it. Without that, clicking the fifth card of a shelf left
   * the position on whatever the previous list had used: the up-next list
   * highlighted the wrong row and Previous was dead.
   */
  const seatIndexFor = useCallback(
    (track) => {
      if (!track?.id) return -1;
      // Matched on id *and* source, as `LibraryContext` does, because the same
      // id can exist on two providers.
      return queueRef.current.findIndex(
        (queued) => queued?.id === track.id && queued?.source === track.source
      );
    },
    []
  );

  function addToQueue(track) {
    commitQueue((prev) => [...prev, track]);
  }

  function playNext(track) {
    commitQueue((prev) => [
      ...prev.slice(0, currentIndex + 1),
      track,
      ...prev.slice(currentIndex + 1),
    ]);
  }

  function removeFromQueue(index) {
    commitQueue((prev) => prev.filter((_, i) => i !== index));
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  function playTrackAt(index) {
    setCurrentIndex(index);
  }

  /**
   * Keep the position inside the queue.
   *
   * `setQueue` is exposed raw and every shelf replaces the whole queue with a
   * shorter or differently-ordered list. Without this, an index left over from a
   * longer queue points past the end, the up-next list renders empty and
   * skipping jumps to an unrelated track. `PlayerContext.playTrack` re-seats the
   * index on the track it starts, so this is only the backstop for queue
   * changes that are not followed by a play.
   */
  useEffect(() => {
    setCurrentIndex((prev) => (prev >= queue.length ? 0 : prev));
  }, [queue]);

  function next() {
    const target = stepIndex(queue, currentIndex, repeat, 1);
    if (target !== NO_INDEX) setCurrentIndex(target);
    return target;
  }

  function previous() {
    const target = stepIndex(queue, currentIndex, repeat, -1);
    if (target !== NO_INDEX) setCurrentIndex(target);
    return target;
  }

  function shuffleQueue() {
    if (!shuffle) {
      setOriginalQueue([...queue]);
      const currentTrack = queue[currentIndex];
      const shuffled = [...queue];

      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Put current track at the beginning
      const currentTrackIndex = currentTrack
        ? shuffled.findIndex(t => t.id === currentTrack.id)
        : -1;
      if (currentTrackIndex > 0) {
        [shuffled[0], shuffled[currentTrackIndex]] = [shuffled[currentTrackIndex], shuffled[0]];
      }

      commitQueue(shuffled);
      setCurrentIndex(0);
      setShuffle(true);
    } else {
      // Un-shuffle
      commitQueue(originalQueue);
      setCurrentIndex(0);
      setShuffle(false);
    }
  }

  function toggleShuffle() {
    shuffleQueue();
  }

  function cycleRepeat() {
    setRepeat(prev => {
      if (prev === 'off') return 'context';
      if (prev === 'context') return 'track';
      return 'off';
    });
  }

  function clearQueue() {
    commitQueue([]);
    setCurrentIndex(0);
    setHistory([]);
  }

  function addToHistory(track) {
    setHistory(prev => [...prev, track].slice(-50)); // Keep last 50 tracks
  }

  return (
    <QueueContext.Provider value={{
      queue,
      setQueue: commitQueue,
      currentIndex,
      setCurrentIndex,
      /** Live queue lookup; see {@link seatIndexFor}. */
      seatIndexFor,
      history,
      shuffle,
      repeat,
      addToQueue,
      playNext,
      removeFromQueue,
      playTrackAt,
      next,
      previous,
      shuffleQueue,
      toggleShuffle,
      cycleRepeat,
      clearQueue,
      addToHistory
    }}>
      {children}
    </QueueContext.Provider>
  );
}

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within QueueProvider');
  }
  return context;
};
