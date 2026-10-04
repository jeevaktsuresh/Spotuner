import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Bell, Menu } from 'lucide-react';

/**
 * Header — the pinned top bar.
 *
 * Back/forward · wide search field · notification bell · avatar. The field owns
 * a local draft and only pushes to the URL on submit, so the Search page stays
 * the single source of truth for the active query.
 *
 * ## Why it is not `position: sticky`
 *
 * `main` is the app's only vertical scroller and this bar is a sibling of it,
 * not an ancestor, so a `sticky top-0` here had nothing to stick to — it was
 * inert, and the frosted `chrome-blur` treatment had no content passing
 * underneath it to blur. The bar is pinned the way the frame actually pins it:
 * a non-shrinking sibling above the scroller. What `sticky` would have given
 * visually is restored below by tracking the scroller's offset and strengthening
 * the chrome once content has scrolled beneath the bar.
 */
export default function Header({ onMenuClick, navOpen = false, menuButtonRef, scroller }) {
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

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Null until App's callback ref has captured `main`, which is why the
    // subscription is keyed on the node rather than mounted once.
    if (!scroller) return undefined;

    // Sampled on the frame the browser was going to paint anyway, so tracking
    // the scroll position costs no layout work of its own.
    let frame = 0;

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(scroller.scrollTop > 0);
      });
    }

    // The scroller is empty on first paint and a later page may restore a
    // non-zero offset, so the initial state has to be sampled too.
    setScrolled(scroller.scrollTop > 0);
    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [scroller]);

  const canGoBack = window.history.length > 1;

  function submitSearch(e) {
    e.preventDefault();
    navigate(query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search');
  }

  return (
    <header
      className={[
        'chrome-blur relative z-[9904] flex h-14 shrink-0 items-center gap-3 px-[var(--gutter)] sm:h-[68px] sm:gap-4',
        // Only once something is underneath it: a hairline makes the bar read as
        // a surface floating over the page, which is what a sticky bar should
        // look like. Unscrolled, the bar is just the top of the document.
        //
        // Drawn as a shadow rather than `.hairline-b` because a border would add
        // a pixel to the bar's height at the exact moment the user starts
        // scrolling, shifting the whole page under the cursor.
        scrolled ? 'shadow-[0_1px_0_rgb(255_255_255/0.07)]' : '',
      ].join(' ')}
    >
      {/* Mobile: open the navigation drawer. The bottom nav carries the primary
          destinations, so this is now the way to the long tail. */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls="site-navigation-drawer"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* History controls. Below `sm` the bar has to share its width with the
          search field, and a phone already has a back gesture and a browser
          back button; three extra 36px targets bought nothing there. */}
      <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
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
      <form onSubmit={submitSearch} className="relative min-w-0 flex-1 sm:max-w-[620px]">
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

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative hidden h-9 w-9 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/[0.07] hover:text-white sm:flex"
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