import type { Loop, Network, Pipe, SolveResult } from '../types';

/** Test fixtures shared by the solver tests and the EPANET cross-validation. */

export function makePipe(
  id: string,
  from: string,
  to: string,
  length: number,
  diameter: number,
  hazenWilliamsC = 140,
  roughness = 0.0000015,
): Pipe {
  return { id, from, to, length, diameter, hazenWilliamsC, roughness };
}

/**
 * Branched network: one reservoir, a trunk and two branches.
 *
 *   R ──P1── J1 ──P2── J2
 *            │
 *            P3
 *            │
 *            J3 ──P4── J4
 */
export function branchedNetwork(): Network {
  return {
    reservoirs: [{ id: 'R', head: 100 }],
    junctions: [
      { id: 'J1', elevation: 60, demand: 0.002 },
      { id: 'J2', elevation: 55, demand: 0.003 },
      { id: 'J3', elevation: 58, demand: 0.0015 },
      { id: 'J4', elevation: 50, demand: 0.0025 },
    ],
    pipes: [
      makePipe('P1', 'R', 'J1', 300, 0.15),
      makePipe('P2', 'J1', 'J2', 200, 0.075),
      makePipe('P3', 'J1', 'J3', 250, 0.1),
      makePipe('P4', 'J3', 'J4', 150, 0.075, 130),
    ],
    pumps: [],
  };
}

/**
 * Two-loop network fed by one reservoir.
 *
 *   R ──P0── A ──P1── B ──P2── C
 *            │        │        │
 *            P3       P4       P5
 *            │        │        │
 *            D ──P6── E ──P7── F
 */
export function twoLoopNetwork(): Network {
  return {
    reservoirs: [{ id: 'R', head: 80 }],
    junctions: [
      { id: 'A', elevation: 40, demand: 0 },
      { id: 'B', elevation: 38, demand: 0.004 },
      { id: 'C', elevation: 35, demand: 0.003 },
      { id: 'D', elevation: 39, demand: 0.005 },
      { id: 'E', elevation: 36, demand: 0.006 },
      { id: 'F', elevation: 33, demand: 0.007 },
    ],
    pipes: [
      makePipe('P0', 'R', 'A', 500, 0.2, 130, 0.00026),
      makePipe('P1', 'A', 'B', 300, 0.15, 130, 0.00026),
      makePipe('P2', 'B', 'C', 300, 0.1, 140, 0.0000015),
      makePipe('P3', 'A', 'D', 250, 0.15, 130, 0.00026),
      makePipe('P4', 'B', 'E', 250, 0.1, 140, 0.0000015),
      makePipe('P5', 'C', 'F', 250, 0.075, 140, 0.0000015),
      makePipe('P6', 'D', 'E', 300, 0.1, 140, 0.0000015),
      makePipe('P7', 'E', 'F', 300, 0.1, 140, 0.0000015),
    ],
    pumps: [],
  };
}

export const TWO_LOOP_LOOPS: Loop[] = [
  {
    id: 'L1',
    pipes: [
      { pipeId: 'P1', direction: 1 },
      { pipeId: 'P4', direction: 1 },
      { pipeId: 'P6', direction: -1 },
      { pipeId: 'P3', direction: -1 },
    ],
  },
  {
    id: 'L2',
    pipes: [
      { pipeId: 'P2', direction: 1 },
      { pipeId: 'P5', direction: 1 },
      { pipeId: 'P7', direction: -1 },
      { pipeId: 'P4', direction: -1 },
    ],
  },
];

/**
 * Low-level reservoir, a pump lifting water into a loop and an elevated reservoir at the far end.
 *
 *   R1 ══PU══ J1 ──P1── J2 ──P3── J4 ──P5── R2
 *              │                   │
 *              P2                  P4
 *              │                   │
 *              J3 ─────────────────┘
 */
export function pumpedNetwork(): Network {
  return {
    reservoirs: [
      { id: 'R1', head: 10 },
      { id: 'R2', head: 45 },
    ],
    junctions: [
      { id: 'J1', elevation: 10, demand: 0 },
      { id: 'J2', elevation: 20, demand: 0.004 },
      { id: 'J3', elevation: 18, demand: 0.003 },
      { id: 'J4', elevation: 25, demand: 0.005 },
    ],
    pipes: [
      makePipe('P1', 'J1', 'J2', 400, 0.15),
      makePipe('P2', 'J1', 'J3', 350, 0.1),
      makePipe('P3', 'J2', 'J4', 300, 0.1),
      makePipe('P4', 'J3', 'J4', 450, 0.1),
      makePipe('P5', 'J4', 'R2', 200, 0.15),
    ],
    pumps: [{ id: 'PU', from: 'R1', to: 'J1', curve: { a: 50, b: 50000, c: 2 } }],
  };
}

export const PUMPED_LOOPS: Loop[] = [
  {
    id: 'L1',
    pipes: [
      { pipeId: 'P1', direction: 1 },
      { pipeId: 'P3', direction: 1 },
      { pipeId: 'P4', direction: -1 },
      { pipeId: 'P2', direction: -1 },
    ],
  },
];

/** Largest |inflow − outflow − demand| over the junctions, m³/s. */
export function maxContinuityError(network: Network, result: SolveResult): number {
  let worst = 0;
  for (const junction of network.junctions) {
    let balance = -junction.demand;
    for (const link of [...network.pipes, ...network.pumps]) {
      const flow = (result.pipes[link.id] ?? result.pumps[link.id])!.flow;
      if (link.to === junction.id) balance += flow;
      if (link.from === junction.id) balance -= flow;
    }
    worst = Math.max(worst, Math.abs(balance));
  }
  return worst;
}

/** Σ signed head loss around a loop, m. */
export function loopHeadLoss(loop: Loop, result: SolveResult): number {
  return loop.pipes.reduce(
    (sum, { pipeId, direction }) => sum + direction * result.pipes[pipeId]!.headLoss,
    0,
  );
}

/** Largest |head[from] − head[to] − headLoss| over the pipes, m. */
export function maxEnergyError(network: Network, result: SolveResult): number {
  let worst = 0;
  for (const pipe of network.pipes) {
    const drop = result.nodes[pipe.from]!.head - result.nodes[pipe.to]!.head;
    worst = Math.max(worst, Math.abs(drop - result.pipes[pipe.id]!.headLoss));
  }
  return worst;
}
