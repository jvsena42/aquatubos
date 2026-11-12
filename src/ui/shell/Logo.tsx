/**
 * Placeholder for the brand mark. It will be replaced by `src/assets/brand/logo-mark.svg`;
 * keep every logo detail inside this component.
 */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--color-primary)" />
      <path
        d="M16 6.5c3.6 4.4 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.4-6.6 6-11Z"
        fill="var(--color-primary-contrast)"
      />
    </svg>
  );
}
