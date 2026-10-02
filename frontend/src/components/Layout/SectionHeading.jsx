import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * SectionHeading — the row of section titles with an optional "See All" link,
 * matching the reference's heading + right-aligned affordance.
 */
export default function SectionHeading({ title, seeAllTo }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-[19px] font-semibold tracking-tight text-white sm:text-[21px]">
        {title}
      </h2>

      {seeAllTo ? (
        <Link
          to={seeAllTo}
          className="group flex shrink-0 items-center gap-1 text-[13px] font-medium text-label-secondary t-global hover:text-white"
        >
          See All
          <ChevronRight
            size={15}
            className="t-global group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  );
}