import { WORDMARK_PATH } from './wordmark';

/**
 * Full logo (mark and wordmark), same geometry as `src/assets/brand/logo-full.svg`, drawn inline
 * so its colours follow the theme.
 */
export function HomeLogo() {
  return (
    <svg className="home-logo" viewBox="4 0 244 64" aria-hidden="true" focusable="false">
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
      <path className="home-logo__word" transform="translate(76 44)" d={WORDMARK_PATH} />
    </svg>
  );
}
