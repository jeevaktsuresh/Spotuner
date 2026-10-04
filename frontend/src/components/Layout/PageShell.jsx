/**
 * PageShell — the single page layout for every route.
 *
 * Owns the three things that used to be re-typed per page and drifted apart:
 * the horizontal gutter, the width cap, and the title block. A page supplies
 * only its content, so two pages opened side by side line up column for column
 * at every breakpoint.
 *
 * `title` is optional because a couple of pages open with a hero instead of a
 * heading; those pass `children` alone and the shell collapses to the gutter
 * and the measure.
 *
 * Vertical scrolling belongs to `main` in App. The shell is a plain document and
 * must never set an `overflow` of its own — see `.page-shell` in index.css.
 */
export default function PageShell({ title, description, actions, children }) {
  return (
    <div className="page-shell">
      {title ? (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 text-[13px] text-label-secondary">{description}</p>
            ) : null}
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}

      {children}
    </div>
  );
}