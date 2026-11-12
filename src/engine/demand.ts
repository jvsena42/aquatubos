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

const SECONDS_PER_DAY = 86400;
const LITRES_PER_CUBIC_METRE = 1000;

function requireNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number, got ${value}`);
  }
}

/**
 * Design flow Q = P·q·K1·K2 / 86400, returned in m³/s.
 * P·q is in litres per day, so the result of the formula is in L/s and is divided by 1000.
 */
export function designFlow(input: DesignFlowInput): number {
  const { population, perCapita, k1 = DEFAULT_K1, k2 = DEFAULT_K2 } = input;
  requireNonNegative('population', population);
  requireNonNegative('perCapita', perCapita);
  requireNonNegative('k1', k1);
  requireNonNegative('k2', k2);
  const litresPerSecond = (population * perCapita * k1 * k2) / SECONDS_PER_DAY;
  return litresPerSecond / LITRES_PER_CUBIC_METRE;
}

export interface DemandPipe {
  id: string;
  from: string;
  to: string;
  /** m */
  length: number;
}

function totalLength(pipes: readonly DemandPipe[]): number {
  let sum = 0;
  for (const pipe of pipes) {
    requireNonNegative(`length of pipe ${pipe.id}`, pipe.length);
    sum += pipe.length;
  }
  return sum;
}

/** Linear (per metre) flow q = Q / ΣL, m³/s per m. */
export function linearFlow(totalFlow: number, pipes: DemandPipe[]): number {
  const length = totalLength(pipes);
  if (length <= 0) {
    throw new RangeError('the total pipe length must be greater than zero');
  }
  return totalFlow / length;
}

/**
 * Distributes a total flow to nodes in proportion to pipe length: each pipe contributes
 * q·L, half to each end node. Ends listed in `excludedNodeIds` (reservoirs) receive nothing and
 * their share goes to the other end. The result sums to `totalFlow`. m³/s by node id.
 *
 * A pipe whose two ends are both excluded serves no node; it is left out of ΣL so the result
 * still sums to `totalFlow`. Nodes appear in the result in the order they are first met in
 * `pipes`; excluded nodes are not listed.
 */
export function distributeDemandByLength(
  totalFlow: number,
  pipes: DemandPipe[],
  excludedNodeIds: string[] = [],
): Record<string, number> {
  const excluded = new Set(excludedNodeIds);
  const serving = pipes.filter((pipe) => !(excluded.has(pipe.from) && excluded.has(pipe.to)));
  const q = linearFlow(totalFlow, serving);

  const demand: Record<string, number> = {};
  for (const pipe of pipes) {
    for (const nodeId of [pipe.from, pipe.to]) {
      if (!excluded.has(nodeId) && !(nodeId in demand)) demand[nodeId] = 0;
    }
  }
  const add = (nodeId: string, flow: number): void => {
    demand[nodeId] = (demand[nodeId] ?? 0) + flow;
  };
  for (const pipe of serving) {
    const pipeFlow = q * pipe.length;
    if (excluded.has(pipe.from)) add(pipe.to, pipeFlow);
    else if (excluded.has(pipe.to)) add(pipe.from, pipeFlow);
    else if (pipe.from === pipe.to) add(pipe.from, pipeFlow);
    else {
      add(pipe.from, pipeFlow / 2);
      add(pipe.to, pipeFlow / 2);
    }
  }
  return demand;
}
