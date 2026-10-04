import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Compass, Radio, Heart } from 'lucide-react';

/**
 * The destinations a phone user reaches most, and which the sidebar drawer is
 * otherwise the only route to.
 *
 * Below `lg` the sidebar is an off-canvas drawer, so every navigation action
 * cost a menu press. This bar is always present, which means the drawer is now
 * genuinely secondary — it holds the long tail (playlists, artists, albums,
 * per-track history) rather than being the only way anywhere.
 *
 * Height comes from `--chrome-nav`, which collapses to 0 at `lg` where the
 * sidebar rail is docked and this bar is `display: none`. Anything that has to
 * clear the bottom chrome — the playback error toast — reads the same variable
 * instead of re-measuring it.
 */
const DESTINATIONS = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/search', label: 'Search', Icon: Search },
  { to: '/browse', label: 'Browse', Icon: Compass },
  { to: '/radio', label: 'Radio', Icon: Radio },
  { to: '/liked', label: 'Library', Icon: Heart },
];

/**
 * One tab.
 *
 * Defined at module scope for the same reason as the sidebar's nav row: a
 * component declared inside `MobileNav` gets a new identity every render, which
 * remounts the bar and drops focus mid-keyboard-navigation.
 */
function NavTab({ to, label, Icon, active }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`tap-row group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 t-global ${
        active ? 'text-accent' : 'text-label-secondary hover:text-white'
      }`}
    >
      <Icon
        size={19}
        strokeWidth={2}
        aria-hidden="true"
        className="shrink-0 t-global"
      />
      <span className="clamp-1 text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export default function MobileNav() {
  const location = useLocation();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      aria-label="Primary"
      className={[
        'chrome-blur hairline-t z-[9902] shrink-0 lg:hidden',
        // `--chrome-nav` plus the home-indicator inset, so the last row of tabs
        // is never the thing sitting under the gesture bar.
        'h-[calc(var(--chrome-nav)+env(safe-area-inset-bottom))]',
        'pb-[env(safe-area-inset-bottom)]',
      ].join(' ')}
    >
      <ul className="flex h-full items-stretch">
        {DESTINATIONS.map((item) => (
          <li key={item.to} className="flex min-w-0 flex-1">
            <NavTab {...item} active={isActive(item.to)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}