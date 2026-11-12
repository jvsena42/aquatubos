import { pipeLoss } from './headloss';
import { solveCholesky } from './linalg';
import { pumpLinkLoss, pumpRunoutFlow } from './pump';
import type {
  Network,
  NodeResult,
  Pipe,
  PipeResult,
  Pump,
  PumpResult,
  SolveOptions,
  SolveResult,
} from './types';
import { pipeArea, velocity, WATER_KINEMATIC_VISCOSITY } from './units';

export const DEFAULT_SOLVE_OPTIONS: SolveOptions = {
  formula: 'hazen-williams',
  kinematicViscosity: WATER_KINEMATIC_VISCOSITY,
  maxIterations: 100,
  flowTolerance: 1e-9,
};

/** Velocity used for the initial flow guess in every pipe, m/s. */
const INITIAL_VELOCITY = 0.3;

/**
 * Mean |Q| per link below which the network is taken to be at rest, m³/s.
 *
 * Flows this small are dominated by rounding of the heads, so the ratio Σ|ΔQ|/Σ|Q| is noise.
 * Below this threshold the change is measured against the threshold instead of Σ|Q|.
 */
const REST_FLOW = 1e-9;

type Link =
  | { kind: 'pipe'; from: number; to: number; pipe: Pipe }
  | { kind: 'pump'; from: number; to: number; pump: Pump };

interface Topology {
  /** Junctions take indices 0 … junctionCount − 1, reservoirs follow. */
  junctionCount: number;
  /** Fixed head by node index (only meaningful for reservoirs). */
  fixedHead: number[];
  links: Link[];
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function resolveOptions(options: Partial<SolveOptions>): SolveOptions {
  const resolved: SolveOptions = { ...DEFAULT_SOLVE_OPTIONS };
  if (options.formula !== undefined) resolved.formula = options.formula;
  if (options.kinematicViscosity !== undefined) {
    resolved.kinematicViscosity = options.kinematicViscosity;
  }
  if (options.maxIterations !== undefined) resolved.maxIterations = options.maxIterations;
  if (options.flowTolerance !== undefined) resolved.flowTolerance = options.flowTolerance;

  if (resolved.formula !== 'hazen-williams' && resolved.formula !== 'darcy-weisbach') {
    throw new Error(`Solver options: unknown head loss formula "${String(resolved.formula)}".`);
  }
  if (!Number.isInteger(resolved.maxIterations) || resolved.maxIterations < 1) {
    throw new Error('Solver options: maxIterations must be an integer of at least 1.');
  }
  if (!isPositive(resolved.flowTolerance)) {
    throw new Error('Solver options: flowTolerance must be a positive number.');
  }
  if (resolved.formula === 'darcy-weisbach' && !isPositive(resolved.kinematicViscosity)) {
    throw new Error('Solver options: kinematicViscosity must be a positive number.');
  }
  return resolved;
}

/** Checks the network and maps node ids to indices. Throws on the first problem found. */
function buildTopology(network: Network, options: SolveOptions): Topology {
  if (network.reservoirs.length === 0) {
    throw new Error('Invalid network: at least one reservoir is required.');
  }

  const nodeIndex = new Map<string, number>();
  const fixedHead: number[] = [];
  for (const junction of network.junctions) {
    if (nodeIndex.has(junction.id)) {
      throw new Error(`Invalid network: duplicate node id "${junction.id}".`);
    }
    if (!Number.isFinite(junction.elevation) || !Number.isFinite(junction.demand)) {
      throw new Error(
        `Invalid network: junction "${junction.id}" needs a finite elevation and demand.`,
      );
    }
    nodeIndex.set(junction.id, nodeIndex.size);
    fixedHead.push(0);
  }
  for (const reservoir of network.reservoirs) {
    if (nodeIndex.has(reservoir.id)) {
      throw new Error(`Invalid network: duplicate node id "${reservoir.id}".`);
    }
    if (!Number.isFinite(reservoir.head)) {
      throw new Error(`Invalid network: reservoir "${reservoir.id}" needs a finite head.`);
    }
    nodeIndex.set(reservoir.id, nodeIndex.size);
    fixedHead.push(reservoir.head);
  }

  const endpoints = (kind: string, id: string, from: string, to: string): [number, number] => {
    const i = nodeIndex.get(from);
    const j = nodeIndex.get(to);
    if (i === undefined) {
      throw new Error(`Invalid network: ${kind} "${id}" starts at unknown node "${from}".`);
    }
    if (j === undefined) {
      throw new Error(`Invalid network: ${kind} "${id}" ends at unknown node "${to}".`);
    }
    if (i === j) {
      throw new Error(`Invalid network: ${kind} "${id}" connects node "${from}" to itself.`);
    }
    return [i, j];
  };

  const links: Link[] = [];
  const pipeIds = new Set<string>();
  for (const pipe of network.pipes) {
    if (pipeIds.has(pipe.id)) throw new Error(`Invalid network: duplicate pipe id "${pipe.id}".`);
    pipeIds.add(pipe.id);
    if (!isPositive(pipe.length)) {
      throw new Error(`Invalid network: pipe "${pipe.id}" must have a positive length.`);
    }
    if (!isPositive(pipe.diameter)) {
      throw new Error(`Invalid network: pipe "${pipe.id}" must have a positive diameter.`);
    }
    if (options.formula === 'hazen-williams' && !isPositive(pipe.hazenWilliamsC)) {
      throw new Error(
        `Invalid network: pipe "${pipe.id}" must have a positive Hazen-Williams coefficient.`,
      );
    }
    if (
      options.formula === 'darcy-weisbach' &&
      !(Number.isFinite(pipe.roughness) && pipe.roughness >= 0)
    ) {
      throw new Error(`Invalid network: pipe "${pipe.id}" must have a non-negative roughness.`);
    }
    const [from, to] = endpoints('pipe', pipe.id, pipe.from, pipe.to);
    links.push({ kind: 'pipe', from, to, pipe });
  }
  const pumpIds = new Set<string>();
  for (const pump of network.pumps) {
    if (pumpIds.has(pump.id)) throw new Error(`Invalid network: duplicate pump id "${pump.id}".`);
    pumpIds.add(pump.id);
    const { a, b, c } = pump.curve;
    if (!isPositive(a) || !isPositive(b) || !isPositive(c)) {
      throw new Error(
        `Invalid network: pump "${pump.id}" needs a curve H = a − b·Q^c with positive a, b and c.`,
      );
    }
    const [from, to] = endpoints('pump', pump.id, pump.from, pump.to);
    links.push({ kind: 'pump', from, to, pump });
  }

  // Every junction must reach a reservoir, otherwise its head is undetermined.
  const junctionCount = network.junctions.length;
  const neighbours: number[][] = fixedHead.map(() => []);
  for (const link of links) {
    neighbours[link.from]!.push(link.to);
    neighbours[link.to]!.push(link.from);
  }
  const reached = fixedHead.map((_, index) => index >= junctionCount);
  const queue = reached.flatMap((isReservoir, index) => (isReservoir ? [index] : []));
  while (queue.length > 0) {
    const node = queue.pop()!;
    for (const next of neighbours[node]!) {
      if (!reached[next]) {
        reached[next] = true;
        queue.push(next);
      }
    }
  }
  const isolated = network.junctions.find((_, index) => !reached[index]);
  if (isolated) {
    throw new Error(
      `Invalid network: junction "${isolated.id}" is not connected to any reservoir.`,
    );
  }

  return { junctionCount, fixedHead, links };
}

/**
 * Steady-state solution of a pressurised network by the Global Gradient Algorithm
 * (Todini & Pilati, 1988). Handles branched and looped networks, any number of reservoirs
 * and pumps. Throws an Error when the network is invalid (unknown node ids, a junction not
 * connected to any reservoir, no reservoir, non-positive length or diameter).
 * Returns `converged: false` when the iteration limit is reached.
 *
 * Method. Each link k from node i to node j obeys h_k(Q_k) = H_i − H_j, where h_k is the pipe
 * head loss or, for a pump, minus the head it adds. Linearising about the current flows with
 * p_k = 1 / h_k'(Q_k) and imposing continuity at every junction gives a symmetric positive
 * definite system for the junction heads:
 *
 *   Σ_k p_k·(H_n − H_m(k)) = Σ_k ±(Q_k − p_k·h_k) − demand_n      (+ for links entering n)
 *
 * with m(k) the node at the other end of link k. The flows then follow from
 * Q_k ← Q_k − p_k·(h_k − (H_i − H_j)). This is Newton's method on the full set of equations, so
 * continuity holds exactly after every iteration and the energy equations converge
 * quadratically.
 *
 * Further checks beyond the list above: duplicate ids, a link from a node to itself, non-finite
 * elevations, demands or heads, a non-positive Hazen-Williams coefficient (or negative roughness
 * for Darcy-Weisbach), a pump curve without positive a, b and c, and invalid options.
 *
 * Pumps: head[to] = head[from] + pumpHead(Q) for Q >= 0. Reverse flow follows the continuation
 * described in `pumpLinkLoss` (no check valve), and `PumpResult.head` is then head[to] −
 * head[from], above the shutoff head.
 *
 * Convergence: Σ|ΔQ| / Σ|Q| < flowTolerance over all links. When Σ|Q| is below 10⁻⁹ m³/s per
 * link (a network at rest, such as one with no demand) that threshold replaces Σ|Q| in the
 * ratio, and the residual is reported as 0 once Σ|ΔQ| is below it too.
 */
export function solveNetwork(network: Network, options: Partial<SolveOptions> = {}): SolveResult {
  const opts = resolveOptions(options);
  const { junctionCount, fixedHead, links } = buildTopology(network, opts);
  const lossOptions = { formula: opts.formula, kinematicViscosity: opts.kinematicViscosity };

  const linkLoss = (link: Link, flow: number): { headLoss: number; gradient: number } =>
    link.kind === 'pipe'
      ? pipeLoss(link.pipe, flow, lossOptions)
      : pumpLinkLoss(link.pump.curve, flow);

  const flows = links.map((link) =>
    link.kind === 'pipe'
      ? INITIAL_VELOCITY * pipeArea(link.pipe.diameter)
      : pumpRunoutFlow(link.pump.curve) / 2,
  );
  // Heads are solved relative to the highest reservoir level. Head differences along a link are
  // then not limited by the rounding of numbers of the order of 100 m, which matters when the
  // flows (and so the differences) are very small.
  const referenceHead = Math.max(...network.reservoirs.map((reservoir) => reservoir.head));
  const relativeHead = fixedHead.map((head, index) =>
    index < junctionCount ? 0 : head - referenceHead,
  );
  const restFlow = REST_FLOW * links.length;

  let converged = false;
  let iterations = 0;
  let residual = Number.POSITIVE_INFINITY;

  while (iterations < opts.maxIterations && !converged) {
    iterations++;
    const matrix = Array.from({ length: junctionCount }, () =>
      new Array<number>(junctionCount).fill(0),
    );
    const rhs = network.junctions.map((junction) => -junction.demand);
    const inverseGradient = new Array<number>(links.length);
    const freeFlow = new Array<number>(links.length);

    links.forEach((link, k) => {
      const { headLoss, gradient } = linkLoss(link, flows[k]!);
      const p = 1 / gradient;
      // Flow the linearised link would carry with no head difference between its ends.
      const y = flows[k]! - p * headLoss;
      inverseGradient[k] = p;
      freeFlow[k] = y;
      const { from, to } = link;
      const fromIsJunction = from < junctionCount;
      const toIsJunction = to < junctionCount;
      if (toIsJunction) {
        matrix[to]![to]! += p;
        rhs[to]! += y;
        if (fromIsJunction) matrix[to]![from]! -= p;
        else rhs[to]! += p * relativeHead[from]!;
      }
      if (fromIsJunction) {
        matrix[from]![from]! += p;
        rhs[from]! -= y;
        if (toIsJunction) matrix[from]![to]! -= p;
        else rhs[from]! += p * relativeHead[to]!;
      }
    });

    const junctionHeads = solveCholesky(matrix, rhs);
    for (let n = 0; n < junctionCount; n++) relativeHead[n] = junctionHeads[n]!;

    let sumChange = 0;
    let sumFlow = 0;
    links.forEach((link, k) => {
      const next =
        freeFlow[k]! + inverseGradient[k]! * (relativeHead[link.from]! - relativeHead[link.to]!);
      sumChange += Math.abs(next - flows[k]!);
      sumFlow += Math.abs(next);
      flows[k] = next;
    });

    residual =
      sumFlow <= restFlow && sumChange <= restFlow ? 0 : sumChange / Math.max(sumFlow, restFlow);
    if (!Number.isFinite(residual)) {
      throw new Error('Solver failed: the iteration produced non-finite flows.');
    }
    converged = residual < opts.flowTolerance;
  }

  // Net outflow of each node into the links, used for the reservoir "demand".
  const netOutflow = new Array<number>(relativeHead.length).fill(0);
  links.forEach((link, k) => {
    netOutflow[link.from]! += flows[k]!;
    netOutflow[link.to]! -= flows[k]!;
  });

  const nodes: Record<string, NodeResult> = {};
  network.junctions.forEach((junction, n) => {
    const head = referenceHead + relativeHead[n]!;
    nodes[junction.id] = {
      id: junction.id,
      head,
      elevation: junction.elevation,
      pressure: head - junction.elevation,
      demand: junction.demand,
    };
  });
  network.reservoirs.forEach((reservoir, r) => {
    nodes[reservoir.id] = {
      id: reservoir.id,
      head: reservoir.head,
      elevation: reservoir.head,
      pressure: 0,
      demand: netOutflow[junctionCount + r]!,
    };
  });

  const pipes: Record<string, PipeResult> = {};
  const pumps: Record<string, PumpResult> = {};
  links.forEach((link, k) => {
    const flow = flows[k]!;
    if (link.kind === 'pipe') {
      const { pipe } = link;
      const loss = pipeLoss(pipe, flow, lossOptions);
      const result: PipeResult = {
        id: pipe.id,
        flow,
        velocity: velocity(flow, pipe.diameter),
        headLoss: loss.headLoss,
        unitHeadLoss: Math.abs(loss.headLoss) / pipe.length,
      };
      if (loss.frictionFactor !== undefined) result.frictionFactor = loss.frictionFactor;
      if (loss.reynolds !== undefined) result.reynolds = loss.reynolds;
      pipes[pipe.id] = result;
    } else {
      const { pump } = link;
      pumps[pump.id] = { id: pump.id, flow, head: -pumpLinkLoss(pump.curve, flow).headLoss };
    }
  });

  return { converged, iterations, residual, formula: opts.formula, nodes, pipes, pumps };
}
