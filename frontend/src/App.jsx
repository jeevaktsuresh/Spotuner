import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { QueueProvider } from './context/QueueContext';
import { LibraryProvider } from './context/LibraryContext';
import { PreferencesProvider } from './context/PreferencesContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import RightPanel from './components/Layout/RightPanel';
import PlayerBar from './components/Player/PlayerBar';
import Home from './components/Pages/Home';
import Search from './components/Pages/Search';
import Radio from './components/Pages/Radio';
import Browse from './components/Pages/Browse';
import Artists from './components/Pages/Artists';
import Artist from './components/Pages/Artist';
import Albums from './components/Pages/Albums';
import Playlists from './components/Pages/Playlists';
import Library from './components/Pages/Library';

export default function App() {
  // Mobile navigation drawer state, owned here so both chrome pieces can drive it.
  const [navOpen, setNavOpen] = useState(false);

  return (
    <Router>
      <PreferencesProvider>
        <LibraryProvider>
          <QueueProvider>
            <PlayerProvider>
              <div className="flex h-screen overflow-hidden bg-surface-base">
                <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

                {/* Main column: sticky header, scrolling page, docked player */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <Header onMenuClick={() => setNavOpen(true)} />

                <div className="flex min-h-0 flex-1">
                  {/* Content */}
                  <main className="scrollable min-w-0 flex-1">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/browse" element={<Browse />} />
                      <Route path="/radio" element={<Radio />} />
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
                  <RightPanel />
                </div>

                <PlayerBar />
              </div>
            </div>
            </PlayerProvider>
          </QueueProvider>
        </LibraryProvider>
      </PreferencesProvider>
    </Router>
  );
}