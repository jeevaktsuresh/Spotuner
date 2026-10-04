/**
 * ShelfRow — the horizontal carousel row that every row of cards renders into.
 *
 * One place for the row's three concerns: it scrolls sideways on one axis only,
 * it hides the scrollbar so the row reads as a carousel, and it bleeds past the
 * page gutter so a card can travel under the edge instead of stopping flush
 * against it. The bleed is derived from `--gutter`, which is what keeps the
 * first card aligned with the section heading above it.
 *
 * Rows scroll horizontally at every breakpoint by design — this is a shelf, not
 * a grid, and pages that want a grid say so with a `grid` class.
 */
export default function ShelfRow({ children, gap = 'gap-4' }) {
  return <div className={`shelf-x scrollbar-hide row-bleed flex ${gap} pb-1`}>{children}</div>;
}