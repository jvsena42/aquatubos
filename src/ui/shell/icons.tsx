import type { ReactNode } from 'react';

/** Decorative inline icons. They inherit the text colour; the label is always nearby text. */
function Icon({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconCheck() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 3 3 5-6" />
    </Icon>
  );
}

export function IconError() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </Icon>
  );
}

export function IconWarning() {
  return (
    <Icon>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5m0 2.5v.01" />
    </Icon>
  );
}

export function IconInfo() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5m0-9v.01" />
    </Icon>
  );
}

export function IconPending() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3.3" />
    </Icon>
  );
}

export function IconStale() {
  return (
    <Icon>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </Icon>
  );
}

export function IconLock() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function IconStar({ filled }: { filled: boolean }) {
  return (
    <Icon filled={filled}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />
    </Icon>
  );
}

export function IconBack() {
  return (
    <Icon>
      <path d="M19 12H5m6-6-6 6 6 6" />
    </Icon>
  );
}

export function IconNext() {
  return (
    <Icon>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </Icon>
  );
}

export function IconBook() {
  return (
    <Icon>
      <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12Z" />
      <path d="M5 16.5a3 3 0 0 1 3-3h11" />
    </Icon>
  );
}

export function IconClose() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}
