import type { HardyCrossOptions, HardyCrossResult, Loop, Network } from './types';
import { WATER_KINEMATIC_VISCOSITY } from './units';

export const DEFAULT_HARDY_CROSS_OPTIONS: HardyCrossOptions = {
  formula: 'hazen-williams',
  kinematicViscosity: WATER_KINEMATIC_VISCOSITY,
  maxIterations: 50,
  tolerance: 1e-7,
};

/**
 * Fundamental loops of the pipe graph (pumps are ignored), each listed in traversal order with
 * the direction of every pipe relative to the loop. Returns [] for a branched network.
 */
export function findLoops(_network: Network): Loop[] {
  throw new Error('not implemented');
}

/**
 * Initial flows that satisfy continuity at every junction, by pipe id (from→to sign), m³/s.
 * No loop pipe should start with zero flow.
 */
export function initialLoopFlows(_network: Network, _loops: Loop[]): Record<string, number> {
  throw new Error('not implemented');
}

/**
 * Hardy Cross loop-correction method with a per-iteration table.
 * Head losses keep the sign of the flow in the loop direction, so Σ hL tends to zero.
 * ΔQ = −Σ hL / Σ (n·|hL|/|Q|).
 */
export function hardyCross(
  _network: Network,
  _loops: Loop[],
  _initialFlows: Record<string, number>,
  _options: Partial<HardyCrossOptions> = {},
): HardyCrossResult {
  throw new Error('not implemented');
}
