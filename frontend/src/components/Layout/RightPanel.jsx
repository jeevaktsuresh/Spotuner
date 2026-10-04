import { X } from 'lucide-react';
import NowPlayingPanel from '../Player/NowPlayingPanel';

/**
 * RightPanel — Now Playing and Queue, at every screen size.
 *
 * Two presentations of one body:
 *
 *   xl and up   a docked 340px rail beside the content
 *   below xl    a bottom sheet, opened from the PlayerBar
 *
 * The panel used to be `hidden xl:flex` with no alternative below `xl`, so on a
 * laptop and a phone the queue could not be seen or reordered at all. The sheet
 * is rendered by the same component as the rail, so there is one queue
 * implementation rather than a desktop copy and a mobile copy.
 *
 * ## One scroller per presentation
 *
 * Both the rail and the sheet scroll once, on the body, and the queue list
 * inside it grows with its content. They previously nested: the body scrolled
 * while the queue `<ul>` scrolled inside it with `max-h-full`, which on a short
 * window trapped the pointer over the queue and left an inner scrollbar with no
 * outer content to move. `NowPlayingPanel` therefore renders no scroller of its
 * own, and the parent is the only place that decides how this panel scrolls.
 *
 * Escape is handled in App with the navigation drawer, so one press closes one
 * layer.
 *
 * @param {boolean} open    sheet visibility; ignored on wide screens
 * @param {Function} onClose
 */
export default function RightPanel({ open = false, onClose }) {
  return (
    <>
      {/* ===== Docked rail, xl and up ===== */}
      <aside className="hidden w-[340px] shrink-0 flex-col bg-surface-panel xl:flex">
        {/* The single scroller, and a plain block rather than a flex column: as a
            flex column it squashed the queue once the content outgrew the rail.
            `scrollbar-hide` because the queue is the list that should read as
            scrollable, not this frame. */}
        <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-5">
          <NowPlayingPanel />
        </div>
      </aside>

      {/* ===== Bottom sheet, below xl ===== */}
      <div
        className={`fixed inset-0 z-[9906] xl:hidden ${open ? '' : 'pointer-events-none'}`}
        // An off-screen sheet must not be reachable by Tab. Boolean rather than
        // `inert=""`: React serialises this as a boolean attribute, so the empty
        // string would be falsy and the attribute dropped.
        inert={!open}
      >
        <div
          onClick={onClose}
          aria-hidden="true"
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Now playing and queue"
          className={`absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-[20px] border-t border-white/[0.08] bg-surface-panel transition-transform duration-300 ease-out ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Grab handle + close, since a sheet has no window to close it. */}
          <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
            <span aria-hidden="true" className="h-1 w-9 rounded-full bg-white/20" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close now playing"
              className="flex h-8 w-8 items-center justify-center rounded-full text-label-secondary t-global hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* The single scroller. `min-h-0` lets it shrink inside the sheet's flex
              column, and the sheet's own `max-h` is what bounds the panel. */}
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <NowPlayingPanel onDismiss={onClose} />
          </div>
        </div>
      </div>
    </>
  );
}