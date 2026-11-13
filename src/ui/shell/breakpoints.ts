import { useEffect } from 'react';
import { useMediaQuery } from './useMediaQuery';

/**
 * The one source of layout breakpoints. Components read the device with `useDevice()`, and
 * `useDeviceAttributes()` (called once in App) mirrors it on <html> so style sheets select on
 * `:root[data-device='phone']` and friends and never repeat the numbers in a media query.
 *
 *   phone    narrow (≤ 760 px), or a phone held sideways (short, not wide, landscape)
 *   tablet   761–1100 px wide and not a phone held sideways
 *   desktop  wider than 1100 px
 */
export type Device = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX_WIDTH = 760;
export const TABLET_MAX_WIDTH = 1100;

export const PHONE_LANDSCAPE_QUERY =
  '(max-height: 500px) and (max-width: 960px) and (orientation: landscape)';
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px), ${PHONE_LANDSCAPE_QUERY}`;
/** Matches tablets and phones; a device is a tablet when this matches and PHONE_QUERY does not. */
export const UP_TO_TABLET_QUERY = `(max-width: ${TABLET_MAX_WIDTH}px)`;
export const LANDSCAPE_QUERY = '(orientation: landscape)';
/** A finger as the main pointer: targets need 44 px. */
export const COARSE_QUERY = '(pointer: coarse)';

/** Pure classification, for tests and for code that already has the matches. */
export function classifyDevice(phone: boolean, upToTablet: boolean): Device {
  if (phone) return 'phone';
  return upToTablet ? 'tablet' : 'desktop';
}

/** Current device class. `desktop` where `matchMedia` does not exist (unit tests). */
export function useDevice(): Device {
  const phone = useMediaQuery(PHONE_QUERY);
  const upToTablet = useMediaQuery(UP_TO_TABLET_QUERY);
  return classifyDevice(phone, upToTablet);
}

export const usePhone = (): boolean => useDevice() === 'phone';
export const useTablet = (): boolean => useDevice() === 'tablet';
/** A phone held sideways: the stage uses a side panel instead of the bottom sheet. */
export const usePhoneLandscape = (): boolean => useMediaQuery(PHONE_LANDSCAPE_QUERY);
export const useLandscape = (): boolean => useMediaQuery(LANDSCAPE_QUERY);
export const useCoarsePointer = (): boolean => useMediaQuery(COARSE_QUERY);

/**
 * Sets `data-device` (`phone`, `tablet`, `desktop`) and `data-orientation` (`portrait`,
 * `landscape`) on <html>. Call once, in App.
 */
export function useDeviceAttributes(): void {
  const device = useDevice();
  const landscape = useLandscape();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.device = device;
    root.dataset.orientation = landscape ? 'landscape' : 'portrait';
  }, [device, landscape]);
}
