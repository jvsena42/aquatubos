import { useCallback, useSyncExternalStore } from 'react';

/**
 * Phone layout: a narrow viewport, or a phone held sideways (short and not wide). Tablets and
 * desktops keep the wide layout. CSS that needs the same condition uses the classes the
 * components set from these queries, so the breakpoint lives here only.
 */
export const PHONE_LANDSCAPE_QUERY =
  '(max-height: 500px) and (max-width: 960px) and (orientation: landscape)';
export const PHONE_QUERY = `(max-width: 760px), ${PHONE_LANDSCAPE_QUERY}`;

/** True while the media query matches. False where `matchMedia` does not exist. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined;
      }
      const media = window.matchMedia(query);
      media.addEventListener?.('change', onChange);
      return () => media.removeEventListener?.('change', onChange);
    },
    [query],
  );
  const snapshot = useCallback(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
