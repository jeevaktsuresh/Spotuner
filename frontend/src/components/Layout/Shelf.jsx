import SectionHeading from './SectionHeading';

/**
 * Shelf — a titled horizontal shelf of cards.
 *
 * Single-row shelves scroll horizontally at every breakpoint and hide their
 * scrollbar, so each row reads as a carousel rather than a clipped grid.
 */
export default function Shelf({ title, seeAllTo, children }) {
  return (
    <section className="mb-9">
      {title ? <SectionHeading title={title} seeAllTo={seeAllTo} /> : null}

      <div className="shelf-x scrollbar-hide flex gap-4 pb-1">{children}</div>
    </section>
  );
}