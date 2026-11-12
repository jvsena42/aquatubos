import type { Stars } from './types';

/** Cost ratio (design / reference) limits for 3 and 2 stars. */
export const STAR_THRESHOLDS = { three: 1.05, two: 1.25 } as const;

/**
 * Stars for a design. A design that fails gets 0. A passing design gets 3 stars when its cost
 * is within 5 % of the reference solution, 2 within 25 %, otherwise 1.
 */
export function starRating(passed: boolean, cost: number, referenceCost: number): Stars {
  if (!passed) return 0;
  if (referenceCost <= 0) return 3;
  const ratio = cost / referenceCost;
  if (ratio <= STAR_THRESHOLDS.three) return 3;
  if (ratio <= STAR_THRESHOLDS.two) return 2;
  return 1;
}
