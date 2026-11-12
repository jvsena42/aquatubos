import type { Network, SolveOptions, SolveResult } from './types';
import { WATER_KINEMATIC_VISCOSITY } from './units';

export const DEFAULT_SOLVE_OPTIONS: SolveOptions = {
  formula: 'hazen-williams',
  kinematicViscosity: WATER_KINEMATIC_VISCOSITY,
  maxIterations: 100,
  flowTolerance: 1e-9,
};

/**
 * Steady-state solution of a pressurised network by the Global Gradient Algorithm
 * (Todini & Pilati, 1988). Handles branched and looped networks, any number of reservoirs
 * and pumps. Throws an Error when the network is invalid (unknown node ids, a junction not
 * connected to any reservoir, no reservoir, non-positive length or diameter).
 * Returns `converged: false` when the iteration limit is reached.
 */
export function solveNetwork(_network: Network, _options: Partial<SolveOptions> = {}): SolveResult {
  throw new Error('not implemented');
}
