import { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';

/**
 * User preferences.
 *
 * There is no existing settings system, but there is an established pattern for
 * persisted preferences: `localStorage` behind a context, with a stable key and a
 * safe parse. This follows it rather than introducing a second mechanism — a
 * separate settings store would fragment the same state across two places.
 *
 * Deliberately narrow. Only the preferences the app actually has a use for are
 * modelled; this is not a general settings framework.
 */

const STORAGE_KEY = 'spotuner_preferences';

export const MUSIC_SOURCES = ['auto', 'youtube', 'spotify'];

const DEFAULTS = {
  /** Which provider to prefer. 'auto' lets the backend choose per track. */
  musicSource: 'auto',
  /** Whether to show the provider badge on cards. */
  showSourceBadge: false,
};

const PreferencesContext = createContext();

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);

      // Merge over defaults and validate, so a hand-edited or stale value can never
      // put the app into an unsupported source mode.
      setPreferences((current) => ({
        ...current,
        ...parsed,
        musicSource: MUSIC_SOURCES.includes(parsed?.musicSource)
          ? parsed.musicSource
          : current.musicSource,
        showSourceBadge:
          typeof parsed?.showSourceBadge === 'boolean'
            ? parsed.showSourceBadge
            : current.showSourceBadge,
      }));
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const setMusicSource = useCallback((source) => {
    if (!MUSIC_SOURCES.includes(source)) return;
    setPreferences((current) => ({ ...current, musicSource: source }));
  }, []);

  const setShowSourceBadge = useCallback((show) => {
    setPreferences((current) => ({ ...current, showSourceBadge: Boolean(show) }));
  }, []);

  const resetPreferences = useCallback(() => setPreferences(DEFAULTS), []);

  // Memoised like the other providers. Its callbacks are already stable, so
  // without this the spread still produced a new object on every render and every
  // preference consumer re-rendered whenever anything above it did.
  const value = useMemo(
    () => ({
      ...preferences,
      setMusicSource,
      setShowSourceBadge,
      resetPreferences,
    }),
    [preferences, setMusicSource, setShowSourceBadge, resetPreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};

export { DEFAULTS as DEFAULT_PREFERENCES };
