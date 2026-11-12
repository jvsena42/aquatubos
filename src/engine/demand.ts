import { NBR_12218 } from './config/nbr12218';

export interface DesignFlowInput {
  /** Inhabitants. */
  population: number;
  /** Per-capita consumption, L/(hab·day). */
  perCapita: number;
  /** Day-of-highest-consumption coefficient. Default NBR_12218.k1. */
  k1?: number;
  /** Hour-of-highest-consumption coefficient. Default NBR_12218.k2. */
  k2?: number;
}

export const DEFAULT_K1 = NBR_12218.k1;
export const DEFAULT_K2 = NBR_12218.k2;

/** Design flow Q = P·q·K1·K2 / 86400, returned in m³/s. */
export function designFlow(_input: DesignFlowInput): number {
  throw new Error('not implemented');
}

export interface DemandPipe {
  id: string;
  from: string;
  to: string;
  /** m */
  length: number;
}

/** Linear (per metre) flow q = Q / ΣL, m³/s per m. */
export function linearFlow(_totalFlow: number, _pipes: DemandPipe[]): number {
  throw new Error('not implemented');
}

/**
 * Distributes a total flow to nodes in proportion to pipe length: each pipe contributes
 * q·L, half to each end node. Ends listed in `excludedNodeIds` (reservoirs) receive nothing and
 * their share goes to the other end. The result sums to `totalFlow`. m³/s by node id.
 */
export function distributeDemandByLength(
  _totalFlow: number,
  _pipes: DemandPipe[],
  _excludedNodeIds: string[] = [],
): Record<string, number> {
  throw new Error('not implemented');
}
