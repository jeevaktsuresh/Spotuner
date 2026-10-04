import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { QueueProvider } from './context/QueueContext';
import { LibraryProvider } from './context/LibraryContext';
import { PreferencesProvider } from './context/PreferencesContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import RightPanel from './components/Layout/RightPanel';
import MobileNav from './components/Layout/MobileNav';
import PlayerBar from './components/Player/PlayerBar';
import Home from './components/Pages/Home';
import Search from './components/Pages/Search';
import Radio from './components/Pages/Radio';
import New from './components/Pages/New';
import Browse from './components/Pages/Browse';
import Artists from './components/Pages/Artists';
import Artist from './components/Pages/Artist';
import Albums from './components/Pages/Albums';
import Playlists from './components/Pages/Playlists';
import Library from './components/Pages/Library';

export default function App() {
  // Mobile navigation drawer state, owned here so both chrome pieces can drive it.
  const [navOpen, setNavOpen] = useState(false);

  // Now Playing / Queue visibility, owned here for the same reason: the PlayerBar
  // opens it and RightPanel closes it. On wide screens RightPanel is a docked rail
  // and ignores this; below `xl` it is a sheet driven by it.
  const [panelOpen, setPanelOpen] = useState(false);

  // The drawer trigger. Held here rather than inside Header because focus has to
  // travel back to it when the drawer closes, whichever way it closed.
  const menuButtonRef = useRef(null);

  // The app's single vertical scroller. Captured as state rather than a ref
  // because a ref is not populated until after the first render has committed,
  // which would leave the Header's subscription with no node to attach to on a
  // page load where nothing else re-renders it.
  const [scroller, setScroller] = useState(null);

  const closeNav = useCallback(() => {
    setNavOpen(false);
    // Escape and the scrim both dismiss the drawer, and so does tapping a link.
    // Returning focus to the trigger is what stops a keyboard user from being
    // dropped back at the top of the document after every navigation.
    menuButtonRef.current?.focus();
  }, []);

  /**
   * Escape closes the topmost layer, once.
   *
   * Centralised rather than bound in each overlay, because with two overlays
   * mounted at once a listener per component closes both on the first Escape.
   * The drawer is the outermost surface, so it wins over the queue sheet.
   */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (navOpen) {
        setNavOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (panelOpen) setPanelOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navOpen, panelOpen]);

  return (
    <Router>
      <PreferencesProvider>
        <LibraryProvider>
          <QueueProvider>
            <PlayerProvider>
              {/*
                The app frame.

                `h-dvh` rather than `h-screen`: `100vh` on a phone is the height
                with the browser toolbar hidden, so the bottom of the frame sat
                underneath that toolbar and the player was half unreachable.

                This element owns the viewport and never scrolls. Exactly one
                descendant scrolls vertically — `main` — and every page is a
                document inside it. The player and the bottom nav are in normal
                flow beneath that scroller rather than fixed over it, which is
                the structural reason neither of them can ever cover page
                content or each other.
              */}
              <div className="flex h-dvh overflow-hidden bg-surface-base">
                <Sidebar open={navOpen} onClose={closeNav} />

                {/* Main column: header, scrolling page, docked player, bottom nav */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Header
                    onMenuClick={() => setNavOpen(true)}
                    navOpen={navOpen}
                    menuButtonRef={menuButtonRef}
                    scroller={scroller}
                  />

                  <div className="flex min-h-0 flex-1">
                    {/* Content */}
                    <main ref={setScroller} className="scrollable min-w-0 flex-1">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/search" element={<Search />} />
                        <Route path="/browse" element={<Browse />} />
                        <Route path="/radio" element={<Radio />} />
                        <Route path="/new" element={<New />} />
                        <Route path="/artists" element={<Artists />} />
                        {/* Declared after /artists so the list still matches exactly. */}
                        <Route path="/artists/:artistKey" element={<Artist />} />
                        <Route path="/albums" element={<Albums />} />
                        <Route path="/playlists" element={<Playlists />} />
                        <Route path="/library" element={<Library />} />
                        <Route path="/liked" element={<Library />} />
                        <Route path="*" element={<Home />} />
                      </Routes>
                    </main>

                    {/* Now Playing / Queue */}
                    <RightPanel
                      open={panelOpen}
                      onClose={() => setPanelOpen(false)}
                    />
                  </div>

                  <PlayerBar onOpenQueue={() => setPanelOpen(true)} />

                  {/* Primary destinations, persistently reachable on phones */}
                  <MobileNav />
                </div>
              </div>
            </PlayerProvider>
          </QueueProvider>
        </LibraryProvider>
      </PreferencesProvider>
    </Router>
  );
}