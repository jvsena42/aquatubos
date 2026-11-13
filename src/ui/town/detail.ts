/**
 * Detail budget of the town drawing. On a phone the whole town is fitted at about 0.3 px per
 * metre: a roof window is 1.5 px and a small tree 5 px, so they cost painting time on every pan
 * and zoom frame without being seen. The root of the view gets a class per zoom bucket and the
 * style sheet hides what is too small to read at that zoom.
 */
export type DetailLevel = 'far' | 'mid' | 'near';

/** Scale (screen px per metre) from which each level of detail is drawn. */
export const DETAIL_MID_SCALE = 0.5;
export const DETAIL_NEAR_SCALE = 0.9;
/** Trees with a smaller radius (m) are left out at the 'far' level: under 6 px across there. */
export const SMALL_TREE_RADIUS = 10;

export function detailLevel(scale: number): DetailLevel {
  if (scale < DETAIL_MID_SCALE) return 'far';
  if (scale < DETAIL_NEAR_SCALE) return 'mid';
  return 'near';
}

/** Class of the root element for a level of detail. */
export function detailClass(scale: number): string {
  return `town--detail-${detailLevel(scale)}`;
}
