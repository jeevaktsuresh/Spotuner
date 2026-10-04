import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Search,
  Compass,
  Radio,
  Heart,
  Sliders,
  User,
  Disc,
  Plus,
  X,
} from 'lucide-react';
import SpotunerBrand from '../Branding/SpotunerBrand';
import { useLibrary } from '../../context/LibraryContext';

const PRIMARY_NAV = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/search', label: 'Search', Icon: Search },
  { to: '/browse', label: 'Browse', Icon: Compass },
  { to: '/radio', label: 'Radio', Icon: Radio },
];

const LIBRARY_NAV = [
  { to: '/liked', label: 'Liked Songs', Icon: Heart },
  { to: '/playlists', label: 'Playlists', Icon: Sliders },
  { to: '/artists', label: 'Artists', Icon: User },
  { to: '/albums', label: 'Albums', Icon: Disc },
];

/** 32px artwork tile for a sidebar playlist row. */
function PlaylistThumb({ src }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-8 w-8 shrink-0 rounded-md object-cover"
      />
    );
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-accent/30 to-accent/10">
      <Sliders size={13} className="text-accent" />
    </span>
  );
}

/**
 * One navigation row.
 *
 * Defined at module scope on purpose: declaring it inside `Sidebar` creates a
 * new component identity per render, which remounts the entire nav on every
 * state change and drops focus.
 */
function NavRow({ to, label, Icon, isActive, onClick }) {
  const active = isActive(to);

  return (
    <li>
      <Link
        to={to}
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium t-global ${
          active
            ? 'bg-accent-track text-accent'
            : 'text-label-secondary hover:bg-white/[0.05] hover:text-white'
        }`}
      >
        <Icon
          size={18}
          strokeWidth={2}
          className={`shrink-0 t-global ${active ? 'text-accent' : 'text-label-secondary'}`}
        />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}

/**
 * Sidebar — fixed primary navigation rail (~245px).
 *
 * Three stacked groups matching the reference: primary nav, "YOUR LIBRARY",
 * and "PLAYLISTS" with a live list from LibraryContext. Below `lg` the whole
 * rail becomes an off-canvas drawer driven by `open`.
 *
 * ## Accessibility of the drawer
 *
 * A closed drawer is translated off-screen but still in the document, so it is
 * still in the tab order and still in the accessibility tree: a keyboard user
 * could Tab straight into a set of links they could not see. It is therefore
 * `inert` while closed, which removes both problems at once.
 *
 * Escape is handled in App, alongside the queue sheet, so that one press closes
 * exactly one layer rather than every listener reacting at once. Focus enters
 * the drawer on its close button and App returns it to the trigger on the way
 * out.
 */
export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const { playlists, recentlyPlayed } = useLibrary();

  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navGroup = (items) =>
    items.map((item) => (
      <NavRow key={item.to} {...item} isActive={isActive} onClick={onClose} />
    ));

  const recentPlaylists = playlists.slice(0, 6);

  const body = (variant) => (
    <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
      {/* Wordmark. Deliberately on the rail's own `px-5` rhythm rather than the
          page `--gutter`: this is chrome, not a page, and indenting it further
          than the nav rows below it would break the rail's hierarchy. */}
      <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
        <Link to="/" aria-label="Spotuner home" onClick={onClose}>
          <SpotunerBrand />
        </Link>

        {variant === 'drawer' ? (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pb-6">
        {/* Primary nav */}
        <ul className="space-y-0.5">
          {navGroup(PRIMARY_NAV)}
        </ul>

        {/* YOUR LIBRARY */}
        <div className="mt-7">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-label-tertiary">
            Your Library
          </p>
          <ul className="space-y-0.5">
            {navGroup(LIBRARY_NAV)}
          </ul>
        </div>

        {/* PLAYLISTS */}
        <div className="mt-7">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-label-tertiary">
            Playlists
          </p>

          <ul className="space-y-0.5">
            <li>
              <Link
                to="/playlists"
                onClick={onClose}
                className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium text-label-secondary t-global hover:bg-white/[0.05] hover:text-white"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white">
                  <Plus size={16} />
                </span>
                <span className="truncate">Create Playlist</span>
              </Link>
            </li>

            {/* User playlists first; fall back to recently played so the
                section is never an empty shell on a fresh install. */}
            {recentPlaylists.length > 0
              ? recentPlaylists.map((playlist) => (
                  <li key={`pl-${playlist.id}`}>
                    <Link
                      to="/playlists"
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-[10px] px-3 py-1.5 text-[13px] text-label-secondary t-global hover:bg-white/[0.05] hover:text-white"
                    >
                      <PlaylistThumb src={playlist.image} name={playlist.name} />
                      <span className="truncate">{playlist.name}</span>
                    </Link>
                  </li>
                ))
              : recentlyPlayed.slice(0, 6).map((track) => (
                  <li key={`rp-${track.id}`}>
                    <Link
                      to="/library"
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-[10px] px-3 py-1.5 text-[13px] text-label-secondary t-global hover:bg-white/[0.05] hover:text-white"
                    >
                      <PlaylistThumb src={track.image} name={track.title} />
                      <span className="truncate">{track.title}</span>
                    </Link>
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop rail. `hidden` takes it out of the tab order too, so the two
          copies of this body never compete for focus. */}
      <aside className="hidden h-full w-[245px] shrink-0 flex-col bg-surface-nav lg:flex">
        {body('rail')}
      </aside>

      {/* Mobile drawer */}
      <div
        id="site-navigation-drawer"
        className={`fixed inset-0 z-[9905] lg:hidden ${open ? '' : 'pointer-events-none'}`}
        // Boolean, not the `inert=""` presence idiom. React serialises `inert` as
        // a boolean attribute, and an empty string is falsy there, so
        // `inert={open ? undefined : ''}` compiles to a removed attribute and the
        // off-screen drawer stays in the tab order.
        inert={!open}
      >
        <div
          onClick={onClose}
          aria-hidden="true"
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          // While the slide-out transition is still running the panel must not
          // read as open to assistive tech, so the drawer is named a dialog for
          // as long as it is on screen — including during the exit animation.
          role="dialog"
          aria-modal={open ? true : undefined}
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[268px] flex-col border-r border-white/[0.06] bg-surface-nav transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {body('drawer')}
        </aside>
      </div>
    </>
  );
}