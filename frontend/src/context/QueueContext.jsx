import { createContext, useState, useContext } from 'react';

export const QueueContext = createContext();

export function QueueProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off' | 'track' | 'context'
  const [originalQueue, setOriginalQueue] = useState([]);

  function addToQueue(track) {
    setQueue(prev => [...prev, track]);
  }

  function playNext(track) {
    setQueue(prev => [
      ...prev.slice(0, currentIndex + 1),
      track,
      ...prev.slice(currentIndex + 1)
    ]);
  }

  function removeFromQueue(index) {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  function playTrackAt(index) {
    setCurrentIndex(index);
  }

  function next() {
    if (repeat === 'track') {
      return currentIndex;
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return currentIndex + 1;
    } else if (repeat === 'context') {
      setCurrentIndex(0);
      return 0;
    }

    return currentIndex;
  }

  function previous() {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return currentIndex - 1;
    }
    return currentIndex;
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
      const currentTrackIndex = shuffled.findIndex(t => t.id === currentTrack.id);
      if (currentTrackIndex > 0) {
        [shuffled[0], shuffled[currentTrackIndex]] = [shuffled[currentTrackIndex], shuffled[0]];
      }

      setQueue(shuffled);
      setCurrentIndex(0);
      setShuffle(true);
    } else {
      // Un-shuffle
      setQueue(originalQueue);
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
    setQueue([]);
    setCurrentIndex(0);
    setHistory([]);
  }

  function addToHistory(track) {
    setHistory(prev => [...prev, track].slice(-50)); // Keep last 50 tracks
  }

  return (
    <QueueContext.Provider value={{
      queue,
      setQueue,
      currentIndex,
      setCurrentIndex,
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
