import { pipeLoss } from './headloss';
import type {
  HardyCrossIteration,
  HardyCrossLoopStep,
  HardyCrossOptions,
  HardyCrossPipeRow,
  HardyCrossResult,
  Loop,
  LoopPipe,
  Network,
  Pipe,
} from './types';
import { WATER_KINEMATIC_VISCOSITY } from './units';

export const DEFAULT_HARDY_CROSS_OPTIONS: HardyCrossOptions = {
  formula: 'hazen-williams',
  kinematicViscosity: WATER_KINEMATIC_VISCOSITY,
  maxIterations: 50,
  tolerance: 1e-7,
};

/** Turns −0 into 0 so tables and JSON never show a negative zero. */
const noNegativeZero = (value: number): number => value + 0;

/** Node ids in a fixed order: reservoirs first, then junctions, both in network order. */
function orderedNodeIds(network: Network): string[] {
  return [...network.reservoirs.map((r) => r.id), ...network.junctions.map((j) => j.id)];
}

function requireKnownNodes(
  nodeIds: ReadonlySet<string>,
  link: { id: string; from: string; to: string },
): void {
  for (const nodeId of [link.from, link.to]) {
    if (!nodeIds.has(nodeId)) {
      throw new Error(`link ${link.id} refers to unknown node ${nodeId}`);
    }
  }
}

interface TreeStep {
  pipe: Pipe;
  /** Node closer to the root. */
  parent: string;
}

/**
 * Fundamental loops of the pipe graph (pumps are ignored), each listed in traversal order with
 * the direction of every pipe relative to the loop. Returns [] for a branched network.
 *
 * Method: a breadth-first spanning tree is grown from every reservoir (in network order) and
 * then from any junction not reached yet; pipes are visited in network order. Every pipe left
 * out of the tree closes exactly one loop with the tree paths of its two ends, so the number
 * of loops is pipes − nodes + connected components. The loops are numbered L1, L2, ... in the
 * network order of the closing pipes.
 *
 * Each loop starts at the node of the loop that is closest to the tree root, goes down the
 * tree to the `from` end of the closing pipe, crosses that pipe and climbs back. The `Network`
 * has no coordinates, so the loop direction is this traversal order and not necessarily
 * clockwise on the drawing. A pipe with both ends at the same node is ignored.
 */
export function findLoops(network: Network): Loop[] {
  const nodeIds = orderedNodeIds(network);
  const known = new Set(nodeIds);
  const adjacency = new Map<string, { pipe: Pipe; other: string }[]>();
  for (const id of nodeIds) adjacency.set(id, []);

  const pipes = network.pipes.filter((pipe) => {
    requireKnownNodes(known, pipe);
    return pipe.from !== pipe.to;
  });
  for (const pipe of pipes) {
    adjacency.get(pipe.from)!.push({ pipe, other: pipe.to });
    adjacency.get(pipe.to)!.push({ pipe, other: pipe.from });
  }

  const parentStep = new Map<string, TreeStep | null>();
  const depth = new Map<string, number>();
  const treePipeIds = new Set<string>();
  for (const root of nodeIds) {
    if (parentStep.has(root)) continue;
    parentStep.set(root, null);
    depth.set(root, 0);
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head]!;
      for (const { pipe, other } of adjacency.get(node)!) {
        if (parentStep.has(other)) continue;
        parentStep.set(other, { pipe, parent: node });
        depth.set(other, depth.get(node)! + 1);
        treePipeIds.add(pipe.id);
        queue.push(other);
      }
    }
  }

  const loops: Loop[] = [];
  for (const chord of pipes) {
    if (treePipeIds.has(chord.id)) continue;

    // Climb from both ends of the closing pipe until the two paths meet.
    const upFromStart: { step: TreeStep; child: string }[] = [];
    const upFromEnd: { step: TreeStep; child: string }[] = [];
    let a = chord.from;
    let b = chord.to;
    while (a !== b) {
      if (depth.get(a)! >= depth.get(b)!) {
        const step = parentStep.get(a)!;
        upFromStart.push({ step, child: a });
        a = step.parent;
      } else {
        const step = parentStep.get(b)!;
        upFromEnd.push({ step, child: b });
        b = step.parent;
      }
    }

    const loopPipes: LoopPipe[] = [];
    // Down the tree, from the meeting node to the start of the closing pipe.
    for (const { step } of upFromStart.reverse()) {
      loopPipes.push({ pipeId: step.pipe.id, direction: step.pipe.from === step.parent ? 1 : -1 });
    }
    loopPipes.push({ pipeId: chord.id, direction: 1 });
    // Up the tree, from the end of the closing pipe back to the meeting node.
    for (const { step, child } of upFromEnd) {
      loopPipes.push({ pipeId: step.pipe.id, direction: step.pipe.from === child ? 1 : -1 });
    }
    loops.push({ id: `L${loops.length + 1}`, pipes: loopPipes });
  }
  return loops;
}

/**
 * Solves the small symmetric system A·x = b by Gaussian elimination with partial pivoting.
 * A dependent row (loops that are not independent) gets x = 0.
 */
function solveLinearSystem(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  const scale = Math.max(...a.flat().map(Math.abs), 0);
  const pivotColumns: number[] = [];
  let row = 0;
  for (let col = 0; col < n && row < n; col++) {
    let pivot = row;
    for (let r = row + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(a[pivot]![col]!) <= scale * 1e-12) continue;
    [a[row], a[pivot]] = [a[pivot]!, a[row]!];
    const pivotRow = a[row]!;
    for (let r = 0; r < n; r++) {
      if (r === row) continue;
      const factor = a[r]![col]! / pivotRow[col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) a[r]![c]! -= factor * pivotRow[c]!;
    }
    pivotColumns.push(col);
    row++;
  }
  const x = new Array<number>(n).fill(0);
  pivotColumns.forEach((col, r) => {
    x[col] = a[r]![n]! / a[r]![col]!;
  });
  return x;
}

/**
 * Initial flows that satisfy continuity at every junction, by pipe id (from→to sign), m³/s.
 * No loop pipe should start with zero flow.
 *
 * Three steps, all deterministic:
 * 1. A breadth-first tree is grown from the reservoirs over pipes and pumps. Each junction is
 *    fed through its tree path only, so the flow of a tree pipe is the demand downstream of it
 *    and the pipes left out of the tree start at zero. This satisfies continuity.
 * 2. A flow circulating around a loop does not change continuity. One circulating flow per
 *    loop is chosen to minimise Σ L·Q², which splits the flow between the branches of a loop
 *    as if every pipe had the same diameter and a loss proportional to L·Q. The circulating
 *    flows are rounded to 1/100 of the order of magnitude of the total demand so that round
 *    demands give round initial flows.
 * 3. If a loop pipe is still at zero (a symmetric network, for instance), a small circulating
 *    flow is added to that loop.
 *
 * Throws when a junction is not connected to any reservoir or a loop names an unknown pipe.
 * With zero total demand every flow is zero.
 */
export function initialLoopFlows(network: Network, loops: Loop[]): Record<string, number> {
  const nodeIds = orderedNodeIds(network);
  const known = new Set(nodeIds);
  const links = [...network.pipes, ...network.pumps];
  const adjacency = new Map<string, { link: (typeof links)[number]; other: string }[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const link of links) {
    requireKnownNodes(known, link);
    if (link.from === link.to) continue;
    adjacency.get(link.from)!.push({ link, other: link.to });
    adjacency.get(link.to)!.push({ link, other: link.from });
  }

  // Step 1: tree flows.
  const parentOf = new Map<string, { linkId: string; from: string; parent: string } | null>();
  const order: string[] = [];
  for (const reservoir of network.reservoirs) {
    parentOf.set(reservoir.id, null);
    order.push(reservoir.id);
  }
  for (let head = 0; head < order.length; head++) {
    const node = order[head]!;
    for (const { link, other } of adjacency.get(node)!) {
      if (parentOf.has(other)) continue;
      parentOf.set(other, { linkId: link.id, from: link.from, parent: node });
      order.push(other);
    }
  }

  const carried = new Map<string, number>();
  let totalDemand = 0;
  for (const junction of network.junctions) {
    if (!parentOf.has(junction.id)) {
      throw new Error(`junction ${junction.id} is not connected to a reservoir`);
    }
    carried.set(junction.id, junction.demand);
    totalDemand += Math.abs(junction.demand);
  }

  const linkFlow = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i]!;
    const up = parentOf.get(node);
    if (!up) continue;
    const flow = carried.get(node) ?? 0;
    linkFlow.set(up.linkId, up.from === up.parent ? flow : -flow);
    if (carried.has(up.parent)) carried.set(up.parent, carried.get(up.parent)! + flow);
  }

  const flows: Record<string, number> = {};
  const lengths = new Map<string, number>();
  for (const pipe of network.pipes) {
    flows[pipe.id] = noNegativeZero(linkFlow.get(pipe.id) ?? 0);
    lengths.set(pipe.id, pipe.length);
  }
  for (const loop of loops) {
    for (const { pipeId } of loop.pipes) {
      if (!lengths.has(pipeId)) throw new Error(`loop ${loop.id} refers to unknown pipe ${pipeId}`);
    }
  }
  if (loops.length === 0 || totalDemand === 0) return flows;

  const circulate = (loop: Loop, amount: number): void => {
    for (const { pipeId, direction } of loop.pipes) {
      flows[pipeId] = noNegativeZero(flows[pipeId]! + direction * amount);
    }
  };

  // Step 2: circulating flows that minimise Σ L·Q².
  const step = 10 ** (Math.floor(Math.log10(totalDemand) + 1e-9) - 2);
  const matrix = loops.map((rowLoop) =>
    loops.map((colLoop) => {
      const columnDirection = new Map<string, number>();
      for (const lp of colLoop.pipes) {
        columnDirection.set(lp.pipeId, (columnDirection.get(lp.pipeId) ?? 0) + lp.direction);
      }
      let sum = 0;
      for (const lp of rowLoop.pipes) {
        sum += lengths.get(lp.pipeId)! * lp.direction * (columnDirection.get(lp.pipeId) ?? 0);
      }
      return sum;
    }),
  );
  const rhs = loops.map((loop) => {
    let sum = 0;
    for (const lp of loop.pipes) sum -= lengths.get(lp.pipeId)! * lp.direction * flows[lp.pipeId]!;
    return sum;
  });
  solveLinearSystem(matrix, rhs).forEach((circulation, index) => {
    circulate(loops[index]!, Math.round(circulation / step) * step);
  });

  // Step 3: move loop pipes away from zero.
  const zeroLimit = totalDemand * 1e-9;
  const hasZeroPipe = (loop: Loop): boolean =>
    loop.pipes.some(({ pipeId }) => Math.abs(flows[pipeId]!) <= zeroLimit);
  const nudge = 10 * step;
  for (const loop of loops) {
    if (!hasZeroPipe(loop)) continue;
    for (const factor of [1, -1, 2, -2, 3, -3]) {
      circulate(loop, factor * nudge);
      if (!hasZeroPipe(loop)) break;
      circulate(loop, -factor * nudge);
    }
  }
  return flows;
}

/**
 * Hardy Cross loop-correction method with a per-iteration table.
 * Head losses keep the sign of the flow in the loop direction, so Σ hL tends to zero.
 * ΔQ = −Σ hL / Σ (n·|hL|/|Q|).
 *
 * Corrections are simultaneous, as in the hand-calculation tables: in one iteration every loop
 * is evaluated with the flows left by the previous iteration, and only then all ΔQ are applied.
 * A pipe that belongs to two loops receives both corrections, each with the sign of the pipe in
 * the respective loop (if the pipe runs with loop I and against loop II, its flow in the
 * direction of loop I changes by ΔQ_I − ΔQ_II). `correctedFlow` is the flow after all the
 * corrections of the iteration, in the direction of the row's loop, and it is the `flow` of
 * the same row in the next iteration.
 *
 * A pipe at exactly zero flow has hL = 0 and contributes the derivative reported by `pipeLoss`
 * to the denominator instead of the undefined n·|hL|/|Q|. A loop whose denominator is zero
 * gets ΔQ = 0. The iteration that meets the tolerance is included in the table and its
 * corrections are applied. `flows` holds every pipe of the network; pipes outside the loops
 * keep their initial flow.
 *
 * The method balances closed loops only. It assumes the loops are independent and that the
 * initial flows satisfy continuity, which the corrections then preserve. Head differences
 * between reservoirs and pump heads are not part of the loop equations.
 */
export function hardyCross(
  network: Network,
  loops: Loop[],
  initialFlows: Record<string, number>,
  options: Partial<HardyCrossOptions> = {},
): HardyCrossResult {
  const { formula, kinematicViscosity, maxIterations, tolerance } = {
    ...DEFAULT_HARDY_CROSS_OPTIONS,
    ...options,
  };

  const pipeById = new Map<string, Pipe>();
  const initial: Record<string, number> = {};
  const flows: Record<string, number> = {};
  for (const pipe of network.pipes) {
    const flow = initialFlows[pipe.id];
    if (flow === undefined || !Number.isFinite(flow)) {
      throw new Error(`missing initial flow for pipe ${pipe.id}`);
    }
    pipeById.set(pipe.id, pipe);
    initial[pipe.id] = noNegativeZero(flow);
    flows[pipe.id] = noNegativeZero(flow);
  }
  for (const loop of loops) {
    for (const { pipeId } of loop.pipes) {
      if (!pipeById.has(pipeId))
        throw new Error(`loop ${loop.id} refers to unknown pipe ${pipeId}`);
    }
  }

  const iterations: HardyCrossIteration[] = [];
  let converged = loops.length === 0;

  for (let iteration = 1; !converged && iteration <= maxIterations; iteration++) {
    const steps: HardyCrossLoopStep[] = loops.map((loop) => {
      let sumHeadLoss = 0;
      let sumNHeadLossOverFlow = 0;
      const rows: HardyCrossPipeRow[] = loop.pipes.map(({ pipeId, direction }) => {
        const pipeFlow = flows[pipeId]!;
        const loss = pipeLoss(pipeById.get(pipeId)!, pipeFlow, { formula, kinematicViscosity });
        const flow = noNegativeZero(direction * pipeFlow);
        const headLoss = noNegativeZero(direction * loss.headLoss);
        let nHeadLossOverFlow: number;
        if (pipeFlow !== 0) {
          nHeadLossOverFlow = (loss.exponent * Math.abs(headLoss)) / Math.abs(flow);
        } else {
          nHeadLossOverFlow =
            Number.isFinite(loss.gradient) && loss.gradient > 0 ? loss.gradient : 0;
        }
        sumHeadLoss += headLoss;
        sumNHeadLossOverFlow += nHeadLossOverFlow;
        return { pipeId, direction, flow, headLoss, nHeadLossOverFlow, correctedFlow: flow };
      });
      const deltaQ =
        sumNHeadLossOverFlow > 0 ? noNegativeZero(-sumHeadLoss / sumNHeadLossOverFlow) : 0;
      return { loopId: loop.id, rows, sumHeadLoss, sumNHeadLossOverFlow, deltaQ };
    });

    if (steps.some((step) => !Number.isFinite(step.deltaQ))) {
      throw new Error(`Hardy Cross produced a non-finite correction in iteration ${iteration}`);
    }

    // All loops were evaluated with the same flows; now every correction is applied.
    for (const step of steps) {
      for (const row of step.rows) {
        flows[row.pipeId] = noNegativeZero(flows[row.pipeId]! + row.direction * step.deltaQ);
      }
    }
    let maxDeltaQ = 0;
    for (const step of steps) {
      maxDeltaQ = Math.max(maxDeltaQ, Math.abs(step.deltaQ));
      for (const row of step.rows) {
        row.correctedFlow = noNegativeZero(row.direction * flows[row.pipeId]!);
      }
    }

    iterations.push({ iteration, loops: steps, maxDeltaQ });
    converged = maxDeltaQ < tolerance;
  }

  return { converged, iterations, initialFlows: initial, flows };
}
