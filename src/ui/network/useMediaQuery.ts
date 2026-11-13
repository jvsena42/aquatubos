import { useSyncExternalStore } from 'react';

/**
 * A phone in either orientation: narrow, or wide but short. Same values as in the style sheets.
 */
export const PHONE_QUERY = '(max-width: 760px), (max-height: 500px)';
/** A finger as the main pointer: targets need 44 px. */
export const COARSE_QUERY = '(pointer: coarse)';

/** True while the media query matches. False where `matchMedia` does not exist (tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
}

export const usePhone = (): boolean => useMediaQuery(PHONE_QUERY);
export const useCoarsePointer = (): boolean => useMediaQuery(COARSE_QUERY);
