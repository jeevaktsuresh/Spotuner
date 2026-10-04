import SectionHeading from './SectionHeading';
import ShelfRow from './ShelfRow';

/**
 * Shelf — a titled horizontal shelf of cards.
 *
 * Single-row shelves scroll horizontally at every breakpoint and hide their
 * scrollbar, so each row reads as a carousel rather than a clipped grid. The row
 * itself is `ShelfRow`, which is also where the gutter bleed lives.
 */
export default function Shelf({ title, seeAllTo, children }) {
  return (
    <section className="mb-9">
      {title ? <SectionHeading title={title} seeAllTo={seeAllTo} /> : null}

      <ShelfRow>{children}</ShelfRow>
    </section>
  );
}