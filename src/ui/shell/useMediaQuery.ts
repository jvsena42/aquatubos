import { useCallback, useSyncExternalStore } from 'react';

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

// The breakpoints live in ./breakpoints; re-exported here for existing imports.
export { PHONE_LANDSCAPE_QUERY, PHONE_QUERY } from './breakpoints';
