import { useSyncExternalStore } from 'react';
import { COARSE_QUERY, PHONE_QUERY } from '../shell/breakpoints';
import type { Quality } from './geometry';

export { COARSE_QUERY };
/** Phones, upright or lying on their side: the shared phone breakpoint. */
export const SMALL_QUERY = PHONE_QUERY;

export interface ViewProfile {
  /** Finger input: larger hit areas and tap tolerance. */
  touch: boolean;
  /** Small screen: short toolbar, legend on demand, fewer and shorter labels. */
  compact: boolean;
  /** Geometry budget of the scene. */
  quality: Quality;
  /** Upper limit of the device pixel ratio the canvas renders at. */
  maxDpr: number;
  /** A tap that moves more than this many CSS pixels is a drag, not a selection. */
  clickSlop: number;
  /** Factor applied to the invisible hit areas of pipes and nodes. */
  hitScale: number;
}

/**
 * Settings of the 3D view for a device. Phones have three times the pixels of a laptop per CSS
 * pixel and a fraction of the GPU, so touch and small screens render at no more than 1.5× with
 * the low geometry budget; a desktop keeps 2× and the full budget.
 */
export function viewProfile({ coarse, small }: { coarse: boolean; small: boolean }): ViewProfile {
  const reduced = coarse || small;
  return {
    touch: coarse,
    compact: small,
    quality: reduced ? 'low' : 'high',
    maxDpr: reduced ? 1.5 : 2,
    clickSlop: coarse ? 10 : 5,
    hitScale: coarse ? 1.8 : 1,
  };
}

function matches(query: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  );
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const lists = [COARSE_QUERY, SMALL_QUERY].map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

const PROFILES = {
  desktop: viewProfile({ coarse: false, small: false }),
  narrow: viewProfile({ coarse: false, small: true }),
  tablet: viewProfile({ coarse: true, small: false }),
  phone: viewProfile({ coarse: true, small: true }),
} as const;

function currentProfile(): ViewProfile {
  const coarse = matches(COARSE_QUERY);
  const small = matches(SMALL_QUERY);
  if (coarse) return small ? PROFILES.phone : PROFILES.tablet;
  return small ? PROFILES.narrow : PROFILES.desktop;
}

/**
 * Profile of the device the view runs on, updated when the window is resized or rotated.
 * Without matchMedia (tests, old browsers) it is the desktop profile.
 */
export function useViewProfile(): ViewProfile {
  return useSyncExternalStore(subscribe, currentProfile, () => PROFILES.desktop);
}
