import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Bell, Menu } from 'lucide-react';

/**
 * Header — sticky top bar (~68px).
 *
 * Back/forward · wide search field · notification bell · avatar. The field owns
 * a local draft and only pushes to the URL on submit, so the Search page stays
 * the single source of truth for the active query.
 */
export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Seeded from the URL so a page reload or a "See All" link keeps the query.
  const urlQuery = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  // Adopt the URL when it changes externally (back button, external link)
  // without clobbering in-progress typing on every keystroke.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const canGoBack = window.history.length > 1;

  function submitSearch(e) {
    e.preventDefault();
    navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
  }

  return (
    <header className="chrome-blur sticky top-0 z-[9904] flex h-[68px] shrink-0 items-center gap-4 px-5 md:px-7">
      {/* Mobile: open the navigation drawer */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* History controls */}
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={!canGoBack}
          aria-label="Previous page"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] t-global text-white hover:bg-white/[0.13] disabled:opacity-40 disabled:hover:bg-white/[0.07]"
        >
          <ChevronLeft size={19} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Next page"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] t-global text-white hover:bg-white/[0.13]"
        >
          <ChevronRight size={19} strokeWidth={2.4} />
        </button>
      </div>

      {/* Search */}
      <form onSubmit={submitSearch} className="relative min-w-0 flex-1 md:max-w-[620px]">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-label-secondary"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, or albums..."
          aria-label="Search songs, artists, or albums"
          className="h-10 w-full rounded-full border border-white/[0.06] bg-white/[0.05] pl-11 pr-5 text-[13px] text-white placeholder:text-label-secondary t-global hover:bg-white/[0.08] focus:border-accent-border focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/[0.07] hover:text-white"
        >
          <Bell size={19} strokeWidth={2} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        {/* Avatar */}
        <button
          type="button"
          aria-label="My Account"
          className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/[0.12] transition-shadow duration-300 hover:shadow-[0_0_0_3px_rgba(231,90,158,0.22)]"
        >
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-accent/50 to-accent/15 text-[12px] font-semibold text-white">
            AP
          </span>
        </button>
      </div>
    </header>
  );
}