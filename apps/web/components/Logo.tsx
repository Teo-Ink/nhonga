// Brand logo, served from /brand (source files in branding/logo). The wordmark
// lockup is used in the header and footer; the standalone symbol lives in the
// favicon (app/icon.svg).
//
// - variant "auto"      → colour logo on light theme, white logo on dark theme
//   (the header sits on --surface, which flips with the theme).
// - variant "invertido" → yellow+white lockup for always-dark surfaces (footer).
// - variant "white"     → all-white lockup (e.g. over a photo).
//
// Plain <img> is intentional: the SVGs are tiny and must not be routed through
// next/image (localPatterns only allows /ph). The repo ESLint has no
// next/no-img-element rule, so this is clean.
export function Logo({
  variant = 'auto',
  label = 'Nhonga',
  className,
}: {
  variant?: 'auto' | 'invertido' | 'white' | 'color';
  label?: string;
  className?: string;
}) {
  const cls = `brandlogo ${className ?? ''}`.trim();

  if (variant === 'auto') {
    return (
      <span className={cls} role="img" aria-label={label}>
        <img
          className="brandlogo__img brandlogo__img--light"
          src="/brand/logo-cor.svg"
          alt=""
          aria-hidden="true"
        />
        <img
          className="brandlogo__img brandlogo__img--dark"
          src="/brand/logo-branco.svg"
          alt=""
          aria-hidden="true"
        />
      </span>
    );
  }

  const src =
    variant === 'invertido'
      ? '/brand/logo-invertido.svg'
      : variant === 'white'
        ? '/brand/logo-branco.svg'
        : '/brand/logo-cor.svg';
  return (
    <span className={cls} role="img" aria-label={label}>
      <img className="brandlogo__img" src={src} alt="" aria-hidden="true" />
    </span>
  );
}
