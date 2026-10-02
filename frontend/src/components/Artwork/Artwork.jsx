/**
 * Artwork placeholder + image.
 * Mirrors Apple Music's artwork-component: a server-supplied dominant colour
 * fills the box, then the real image fades in over it.
 */
export default function Artwork({
  src,
  alt,
  bgColor = '#1c1822',
  ratio,
  className = '',
  imgClassName = '',
  sizes,
  eager = false,
  rounded = 'rounded-[4px]',
}) {
  const ratioStyle = ratio ? { aspectRatio: String(ratio) } : undefined;

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ backgroundColor: bgColor, ...ratioStyle }}
    >
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          role="presentation"
          sizes={sizes}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
        />
      ) : null}
    </div>
  );
}
