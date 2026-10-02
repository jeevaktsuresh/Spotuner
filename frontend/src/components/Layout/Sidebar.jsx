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
 */
export default function Sidebar({ open = false, onClose }) {
  const location = useLocation();
  const { playlists, recentlyPlayed } = useLibrary();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navGroup = (items) =>
    items.map((item) => (
      <NavRow key={item.to} {...item} isActive={isActive} onClick={onClose} />
    ));

  const recentPlaylists = playlists.slice(0, 6);

  const body = (
    <nav className="flex min-h-0 flex-1 flex-col">
      {/* Wordmark */}
      <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
        <Link to="/" aria-label="Spotuner home" onClick={onClose}>
          <SpotunerBrand />
        </Link>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="flex h-8 w-8 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X size={18} />
        </button>
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
      {/* Desktop rail */}
      <aside className="hidden h-full w-[245px] shrink-0 flex-col bg-surface-nav lg:flex">
        {body}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[9905] lg:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[268px] flex-col border-r border-white/[0.06] bg-surface-nav transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {body}
        </aside>
      </div>
    </>
  );
}