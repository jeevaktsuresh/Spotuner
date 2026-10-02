/**
 * SpotunerBrand — the wordmark lockup.
 *
 * The logo mark functions as the letter "S", so the lockup reads
 * "[logo]potuner" as one unit rather than an icon sitting beside a word.
 * The mark is locked to a fixed square box (--brand-icon-size) with
 * `object-contain`, so it renders at exactly 40x40 without distorting or
 * cropping the source artwork. `items-center` vertically centres the mark
 * against the "potuner" text, and `flex-shrink: 0` stops it collapsing.
 *
 * Sizing is driven entirely by CSS variables declared in index.css
 * (`--brand-icon-size`, `--brand-text-size`, `--brand-gap`),
 * so the lockup can be retuned from one place without touching this component.
 */
export default function SpotunerBrand({ className = '' }) {
  return (
    <span
      className={`inline-flex select-none items-center no-drag ${className}`}
      style={{
        gap: 'var(--brand-gap)',
        paddingLeft: 'var(--brand-pad-x)',
      }}
    >
      <img
        src="/Logo.png"
        alt=""
        aria-hidden="true"
        width={1254}
        height={1254}
        className="shrink-0 object-contain"
        style={{
          height: 'var(--brand-icon-size)',
          width: 'var(--brand-icon-size)',
        }}
        draggable={false}
      />
      <span
        className="font-semibold leading-none tracking-tight text-white"
        style={{ fontSize: 'var(--brand-text-size)' }}
      >
        potuner
      </span>
    </span>
  );
}
