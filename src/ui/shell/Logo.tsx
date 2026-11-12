/**
 * Brand mark, same geometry as `src/assets/brand/logo-mark.svg`, drawn inline so its colours
 * follow the theme tokens.
 */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path fill="var(--color-brand-water)" d="M14 39A18 18 0 0 0 50 39Z" />
      <path
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="5"
        strokeLinejoin="round"
        d="M32 9 46.4 28.2A18 18 0 1 1 17.6 28.2ZM14 39H50"
      />
      <g fill="var(--color-brand-accent)">
        <circle cx="32" cy="9" r="5.5" />
        <circle cx="14" cy="39" r="5.5" />
        <circle cx="50" cy="39" r="5.5" />
      </g>
    </svg>
  );
}
