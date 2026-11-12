import { DEFAULT_HARDY_CROSS_OPTIONS, findLoops, hardyCross, initialLoopFlows } from './hardyCross';
import type { HardyCrossResult, Loop, Network, Pipe } from './types';

/**
 * `headloss.ts` is implemented in parallel with this module, so these tests replace it with a
 * local Hazen-Williams / Darcy-Weisbach implementation. `hardyCross.gga.test.ts` runs against
 * the real module.
 */
vi.mock('./headloss', () => {
  const GRAVITY = 9.80665;
  return {
    pipeLoss(
      pipe: { length: number; diameter: number; hazenWilliamsC: number; roughness: number },
      flow: number,
      options: { formula: string; kinematicViscosity: number },
    ) {
      const q = Math.abs(flow);
      const sign = Math.sign(flow);
      if (options.formula === 'hazen-williams') {
        const k = (10.643 * pipe.length) / (pipe.hazenWilliamsC ** 1.852 * pipe.diameter ** 4.87);
        const loss = k * q ** 1.852;
        // True derivative; it is zero at Q = 0.
        return { headLoss: sign * loss, gradient: 1.852 * k * q ** 0.852, exponent: 1.852 };
      }
      const area = (Math.PI * pipe.diameter ** 2) / 4;
      const laminarGradient =
        (128 * options.kinematicViscosity * pipe.length) / (Math.PI * GRAVITY * pipe.diameter ** 4);
      if (q === 0) {
        return { headLoss: 0, gradient: laminarGradient, exponent: 2, reynolds: 0 };
      }
      const speed = q / area;
      const reynolds = (speed * pipe.diameter) / options.kinematicViscosity;
      const frictionFactor =
        reynolds < 2000
          ? 64 / reynolds
          : 0.25 / Math.log10(pipe.roughness / (3.7 * pipe.diameter) + 5.74 / reynolds ** 0.9) ** 2;
      const loss = (frictionFactor * pipe.length * speed ** 2) / (pipe.diameter * 2 * GRAVITY);
      return {
        headLoss: sign * loss,
        gradient: reynolds < 2000 ? laminarGradient : (2 * loss) / q,
        exponent: 2,
        frictionFactor,
        reynolds,
      };
    },
  };
});

const pipe = (id: string, from: string, to: string, length: number, diameter: number): Pipe => ({
  id,
  from,
  to,
  length,
  diameter,
  hazenWilliamsC: 100,
  roughness: 0.0001,
});

/** Hazen-Williams resistance K of hL = K·Q^1.852. */
const resistance = (p: Pipe): number =>
  (10.643 * p.length) / (p.hazenWilliamsC ** 1.852 * p.diameter ** 4.87);

const hwLoss = (p: Pipe, flow: number): number =>
  Math.sign(flow) * resistance(p) * Math.abs(flow) ** 1.852;

/**
 * One loop fed at A:
 *
 *   R ──P0── A ──P1── B
 *            │        │
 *            P3       P2
 *            │        │
 *            C ──P4── D
 *
 * Demands: B 20 L/s, C 30 L/s, D 50 L/s (100 L/s enter at A).
 */
const singleLoop: Network = {
  junctions: [
    { id: 'A', elevation: 0, demand: 0 },
    { id: 'B', elevation: 0, demand: 0.02 },
    { id: 'C', elevation: 0, demand: 0.03 },
    { id: 'D', elevation: 0, demand: 0.05 },
  ],
  reservoirs: [{ id: 'R', head: 50 }],
  pipes: [
    pipe('P0', 'R', 'A', 100, 0.3),
    pipe('P1', 'A', 'B', 500, 0.25),
    pipe('P2', 'B', 'D', 400, 0.2),
    pipe('P3', 'A', 'C', 400, 0.2),
    pipe('P4', 'C', 'D', 500, 0.15),
  ],
  pumps: [],
};

/** A → B → D → C → A. */
const singleLoopClockwise: Loop[] = [
  {
    id: 'I',
    pipes: [
      { pipeId: 'P1', direction: 1 },
      { pipeId: 'P2', direction: 1 },
      { pipeId: 'P4', direction: -1 },
      { pipeId: 'P3', direction: -1 },
    ],
  },
];

const singleLoopGuess = { P0: 0.1, P1: 0.06, P2: 0.04, P3: 0.04, P4: 0.01 };

/**
 * Two loops side by side, fed at node 1:
 *
 *   R ──P0── 1 ──P12── 2 ──P23── 3
 *            │         │         │
 *           P14       P25       P36
 *            │         │         │
 *            4 ──P45── 5 ──P56── 6
 */
const twoLoops: Network = {
  junctions: [
    { id: '1', elevation: 0, demand: 0 },
    { id: '2', elevation: 0, demand: 0.01 },
    { id: '3', elevation: 0, demand: 0.015 },
    { id: '4', elevation: 0, demand: 0.01 },
    { id: '5', elevation: 0, demand: 0.02 },
    { id: '6', elevation: 0, demand: 0.025 },
  ],
  reservoirs: [{ id: 'R', head: 60 }],
  pipes: [
    pipe('P0', 'R', '1', 200, 0.3),
    pipe('P12', '1', '2', 300, 0.25),
    pipe('P23', '2', '3', 300, 0.15),
    pipe('P14', '1', '4', 250, 0.2),
    pipe('P25', '2', '5', 250, 0.15),
    pipe('P36', '3', '6', 250, 0.1),
    pipe('P45', '4', '5', 300, 0.15),
    pipe('P56', '5', '6', 300, 0.1),
  ],
  pumps: [],
};

/** Three squares in a row: 1-2-3-4 on top, 5-6-7-8 below. */
const threeLoops: Network = {
  junctions: ['1', '2', '3', '4', '5', '6', '7', '8'].map((id, i) => ({
    id,
    elevation: 0,
    demand: i === 0 ? 0 : 0.005,
  })),
  reservoirs: [{ id: 'R', head: 60 }],
  pipes: [
    pipe('P0', 'R', '1', 100, 0.3),
    pipe('P12', '1', '2', 200, 0.2),
    pipe('P23', '2', '3', 200, 0.15),
    pipe('P34', '3', '4', 200, 0.1),
    pipe('P15', '1', '5', 200, 0.2),
    pipe('P26', '2', '6', 200, 0.1),
    pipe('P37', '3', '7', 200, 0.1),
    pipe('P48', '4', '8', 200, 0.1),
    pipe('P56', '5', '6', 200, 0.15),
    pipe('P67', '6', '7', 200, 0.1),
    pipe('P78', '7', '8', 200, 0.1),
  ],
  pumps: [],
};

/** Net flow into each junction minus its demand; zero when continuity holds. */
function continuityErrors(network: Network, flows: Record<string, number>): number[] {
  return network.junctions.map((junction) => {
    let balance = -junction.demand;
    for (const p of network.pipes) {
      if (p.to === junction.id) balance += flows[p.id]!;
      if (p.from === junction.id) balance -= flows[p.id]!;
    }
    return balance;
  });
}

function expectContinuity(network: Network, flows: Record<string, number>): void {
  for (const error of continuityErrors(network, flows)) {
    expect(Math.abs(error)).toBeLessThan(1e-12);
  }
}

/** Checks that a loop is a closed walk and returns the nodes visited. */
function walkLoop(network: Network, loop: Loop): string[] {
  const byId = new Map(network.pipes.map((p) => [p.id, p]));
  const ends = loop.pipes.map((lp) => {
    const p = byId.get(lp.pipeId)!;
    return lp.direction === 1 ? { start: p.from, end: p.to } : { start: p.to, end: p.from };
  });
  ends.forEach((segment, i) => {
    const next = ends[(i + 1) % ends.length]!;
    expect(segment.end).toBe(next.start);
  });
  expect(new Set(loop.pipes.map((lp) => lp.pipeId)).size).toBe(loop.pipes.length);
  return ends.map((segment) => segment.start);
}

/** Flows of every pipe after each iteration, rebuilt from the table rows. */
function flowsPerIteration(result: HardyCrossResult): Record<string, number>[] {
  const flows = { ...result.initialFlows };
  return result.iterations.map((iteration) => {
    for (const step of iteration.loops) {
      for (const row of step.rows) flows[row.pipeId] = row.direction * row.correctedFlow;
    }
    return { ...flows };
  });
}

const describeLoops = (loops: Loop[]): string[] =>
  loops.map(
    (loop) =>
      `${loop.id}: ${loop.pipes.map((lp) => `${lp.direction === 1 ? '+' : '-'}${lp.pipeId}`).join(' ')}`,
  );

describe('findLoops', () => {
  it('returns no loop for a branched network', () => {
    const branched: Network = {
      ...singleLoop,
      pipes: singleLoop.pipes.filter((p) => p.id !== 'P4'),
    };
    expect(findLoops(branched)).toEqual([]);
  });

  it('finds the single loop in traversal order with pipe directions', () => {
    const loops = findLoops(singleLoop);
    // P4 closes the loop: A → C (P3), C → D (P4), D → B (against P2), B → A (against P1).
    expect(describeLoops(loops)).toEqual(['L1: +P3 +P4 -P2 -P1']);
    expect(walkLoop(singleLoop, loops[0]!)).toEqual(['A', 'C', 'D', 'B']);
  });

  it('finds two loops that share a pipe with opposite directions', () => {
    const loops = findLoops(twoLoops);
    expect(describeLoops(loops)).toEqual(['L1: +P14 +P45 -P25 -P12', 'L2: +P25 +P56 -P36 -P23']);
    for (const loop of loops) walkLoop(twoLoops, loop);
  });

  it('finds three independent loops', () => {
    const loops = findLoops(threeLoops);
    // pipes − nodes + components = 11 − 9 + 1
    expect(loops).toHaveLength(3);
    expect(loops.map((l) => l.id)).toEqual(['L1', 'L2', 'L3']);
    for (const loop of loops) walkLoop(threeLoops, loop);
    // Each loop has a pipe that no other loop uses, so the loops are independent.
    for (const loop of loops) {
      const others = new Set(
        loops.filter((l) => l !== loop).flatMap((l) => l.pipes.map((lp) => lp.pipeId)),
      );
      expect(loop.pipes.some((lp) => !others.has(lp.pipeId))).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(findLoops(threeLoops)).toEqual(findLoops(threeLoops));
  });

  it('treats two pipes between the same nodes as a loop', () => {
    const parallel: Network = {
      junctions: [{ id: 'A', elevation: 0, demand: 0.01 }],
      reservoirs: [{ id: 'R', head: 10 }],
      pipes: [pipe('Pa', 'R', 'A', 100, 0.1), pipe('Pb', 'A', 'R', 100, 0.1)],
      pumps: [],
    };
    const loops = findLoops(parallel);
    expect(describeLoops(loops)).toEqual(['L1: +Pa +Pb']);
    walkLoop(parallel, loops[0]!);
  });

  it('ignores pumps and pipes that start and end at the same node', () => {
    const network: Network = {
      ...singleLoop,
      pipes: [...singleLoop.pipes.filter((p) => p.id !== 'P4'), pipe('Px', 'B', 'B', 10, 0.1)],
      pumps: [{ id: 'B1', from: 'C', to: 'D', curve: { a: 30, b: 1000, c: 2 } }],
    };
    expect(findLoops(network)).toEqual([]);
  });

  it('finds loops in a part of the network that has no reservoir', () => {
    const network: Network = {
      junctions: ['A', 'B', 'C'].map((id) => ({ id, elevation: 0, demand: 0 })),
      reservoirs: [],
      pipes: [
        pipe('P1', 'A', 'B', 100, 0.1),
        pipe('P2', 'B', 'C', 100, 0.1),
        pipe('P3', 'C', 'A', 100, 0.1),
      ],
      pumps: [],
    };
    const loops = findLoops(network);
    expect(loops).toHaveLength(1);
    walkLoop(network, loops[0]!);
  });

  it('throws when a pipe refers to an unknown node', () => {
    const broken: Network = { ...singleLoop, pipes: [pipe('P9', 'A', 'Z', 100, 0.1)] };
    expect(() => findLoops(broken)).toThrow(/unknown node Z/);
  });
});

describe('initialLoopFlows', () => {
  it('returns the tree flows of a branched network', () => {
    const branched: Network = {
      ...singleLoop,
      pipes: singleLoop.pipes.filter((p) => p.id !== 'P4'),
    };
    // D (50 L/s) is fed through B, so P1 carries 20 + 50 and P3 only the 30 L/s of C.
    const flows = initialLoopFlows(branched, []);
    expect(flows.P0).toBeCloseTo(0.1, 12);
    expect(flows.P1).toBeCloseTo(0.07, 12);
    expect(flows.P2).toBeCloseTo(0.05, 12);
    expect(flows.P3).toBeCloseTo(0.03, 12);
    expectContinuity(branched, flows);
  });

  it('splits the flow around a single loop', () => {
    const loops = findLoops(singleLoop);
    const flows = initialLoopFlows(singleLoop, loops);
    // Tree flows: P1 = 70, P2 = 50, P3 = 30, P4 = 0 L/s. A flow x circulating along
    // +P3 +P4 −P2 −P1 minimises 400·(30+x)² + 500·x² + 400·(50−x)² + 500·(70−x)²:
    // 1800·x = 43 000 → x = 23.9 L/s, rounded to the step of 1 L/s → 24 L/s.
    expect(flows.P0).toBeCloseTo(0.1, 12);
    expect(flows.P1).toBeCloseTo(0.046, 12);
    expect(flows.P2).toBeCloseTo(0.026, 12);
    expect(flows.P3).toBeCloseTo(0.054, 12);
    expect(flows.P4).toBeCloseTo(0.024, 12);
    expectContinuity(singleLoop, flows);
  });

  it('satisfies continuity and leaves no loop pipe at zero in looped networks', () => {
    for (const network of [twoLoops, threeLoops]) {
      const loops = findLoops(network);
      const flows = initialLoopFlows(network, loops);
      expect(Object.keys(flows)).toEqual(network.pipes.map((p) => p.id));
      expectContinuity(network, flows);
      for (const loop of loops) {
        for (const { pipeId } of loop.pipes) expect(Math.abs(flows[pipeId]!)).toBeGreaterThan(1e-6);
      }
      expect(initialLoopFlows(network, loops)).toEqual(flows);
    }
  });

  it('moves a pipe away from zero when the balanced split leaves it without flow', () => {
    // Symmetric bridge: by symmetry the least-squares split puts no flow in P3.
    const bridge: Network = {
      junctions: [
        { id: 'A', elevation: 0, demand: 0 },
        { id: 'B', elevation: 0, demand: 0 },
        { id: 'C', elevation: 0, demand: 0 },
        { id: 'D', elevation: 0, demand: 0.02 },
      ],
      reservoirs: [{ id: 'R', head: 30 }],
      pipes: [
        pipe('P0', 'R', 'A', 100, 0.2),
        pipe('P1', 'A', 'B', 100, 0.1),
        pipe('P2', 'A', 'C', 100, 0.1),
        pipe('P3', 'B', 'C', 100, 0.1),
        pipe('P4', 'B', 'D', 100, 0.1),
        pipe('P5', 'C', 'D', 100, 0.1),
      ],
      pumps: [],
    };
    const loops = findLoops(bridge);
    expect(describeLoops(loops)).toEqual(['L1: +P1 +P3 -P2', 'L2: +P2 +P5 -P4 -P1']);
    const flows = initialLoopFlows(bridge, loops);
    // Balanced split: 10 L/s in each branch and 0 in the bridge. Loop L1 then receives a
    // circulating flow of 1 L/s (ten rounding steps of 0.1 L/s).
    expect(flows.P1).toBeCloseTo(0.011, 12);
    expect(flows.P2).toBeCloseTo(0.009, 12);
    expect(flows.P3).toBeCloseTo(0.001, 12);
    expect(flows.P4).toBeCloseTo(0.01, 12);
    expect(flows.P5).toBeCloseTo(0.01, 12);
    expectContinuity(bridge, flows);
  });

  it('returns zero flows when there is no demand', () => {
    const idle: Network = {
      ...singleLoop,
      junctions: singleLoop.junctions.map((j) => ({ ...j, demand: 0 })),
    };
    expect(initialLoopFlows(idle, findLoops(idle))).toEqual({ P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 });
  });

  it('carries the demand through a pump in series', () => {
    const pumped: Network = {
      ...singleLoop,
      junctions: [{ id: 'S', elevation: 0, demand: 0 }, ...singleLoop.junctions],
      pipes: [pipe('P0', 'R', 'S', 100, 0.3), ...singleLoop.pipes.slice(1)],
      pumps: [{ id: 'B1', from: 'S', to: 'A', curve: { a: 30, b: 1000, c: 2 } }],
    };
    const flows = initialLoopFlows(pumped, findLoops(pumped));
    expect(Object.keys(flows)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']);
    expect(flows.P0).toBeCloseTo(0.1, 12);
    expect(flows.P1! + flows.P3!).toBeCloseTo(0.1, 12);
  });

  it('feeds each junction from the nearest reservoir when there are several', () => {
    const twoSources: Network = {
      ...singleLoop,
      reservoirs: [...singleLoop.reservoirs, { id: 'R2', head: 45 }],
      pipes: [...singleLoop.pipes, pipe('P5', 'D', 'R2', 100, 0.2)],
    };
    const flows = initialLoopFlows(twoSources, findLoops(twoSources));
    expectContinuity(twoSources, flows);
    // D is one pipe away from R2, so its tree flow arrives against the direction of P5.
    expect(flows.P5).toBeLessThan(0);
  });

  it('accepts loops that are not independent', () => {
    const loops = findLoops(singleLoop);
    const repeated = [loops[0]!, { ...loops[0]!, id: 'L2' }];
    const flows = initialLoopFlows(singleLoop, repeated);
    expectContinuity(singleLoop, flows);
    expect(flows.P4).toBeCloseTo(0.024, 12);
  });

  it('throws for a junction without a path to a reservoir', () => {
    const isolated: Network = {
      ...singleLoop,
      junctions: [...singleLoop.junctions, { id: 'Z', elevation: 0, demand: 0.01 }],
    };
    expect(() => initialLoopFlows(isolated, [])).toThrow(/junction Z is not connected/);
    expect(() => initialLoopFlows({ ...singleLoop, reservoirs: [] }, [])).toThrow(/unknown node R/);
  });

  it('throws for a loop that names an unknown pipe', () => {
    const loops: Loop[] = [{ id: 'L1', pipes: [{ pipeId: 'P99', direction: 1 }] }];
    expect(() => initialLoopFlows(singleLoop, loops)).toThrow(/unknown pipe P99/);
  });
});

describe('hardyCross: first iteration by hand', () => {
  const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess, { maxIterations: 1 });
  const step = result.iterations[0]!.loops[0]!;

  it('fills the table of the loop', () => {
    // hL = K·Q^1.852 with K = 10.643·L / (C^1.852 · D^4.87), C = 100.
    //
    // pipe  L    D     K          Q (loop)  |Q|^1.852    hL        n·|hL|/|Q|
    // P1    500  0.25    899.635  +0.060    0.00545929   +4.9114   151.598
    // P2    400  0.20   2133.575  +0.040    0.00257641   +5.4970   254.510
    // P4    500  0.15  10826.040  −0.010    0.00019770   −2.1403   396.379
    // P3    400  0.20   2133.575  −0.040    0.00257641   −5.4970   254.510
    //                                               Σ =  +2.7711  1056.996
    //
    // ΔQ = −2.7711 / 1056.996 = −0.0026217 m³/s (−2.62 L/s)
    expect(step.rows.map((r) => r.pipeId)).toEqual(['P1', 'P2', 'P4', 'P3']);
    expect(step.rows.map((r) => r.direction)).toEqual([1, 1, -1, -1]);
    expect(step.rows.map((r) => r.flow)).toEqual([0.06, 0.04, -0.01, -0.04]);

    const headLosses = [4.9114, 5.497, -2.1403, -5.497];
    const ratios = [151.598, 254.51, 396.379, 254.51];
    step.rows.forEach((row, i) => {
      expect(row.headLoss).toBeCloseTo(headLosses[i]!, 3);
      expect(row.nHeadLossOverFlow).toBeCloseTo(ratios[i]!, 2);
    });
    expect(step.sumHeadLoss).toBeCloseTo(2.7711, 3);
    expect(step.sumNHeadLossOverFlow).toBeCloseTo(1056.996, 2);
    expect(step.deltaQ).toBeCloseTo(-0.0026217, 6);
    expect(result.iterations[0]!.maxDeltaQ).toBeCloseTo(0.0026217, 6);
  });

  it('applies the correction with the sign of each pipe in the loop', () => {
    // In the loop direction every flow receives ΔQ: 60 − 2.62, 40 − 2.62, −10 − 2.62, −40 − 2.62.
    const corrected = [0.0573783, 0.0373783, -0.0126217, -0.0426217];
    step.rows.forEach((row, i) => expect(row.correctedFlow).toBeCloseTo(corrected[i]!, 6));
    // In the pipe direction, P3 and P4 run against the loop and gain what P1 and P2 lose.
    expect(result.flows.P1).toBeCloseTo(0.0573783, 6);
    expect(result.flows.P2).toBeCloseTo(0.0373783, 6);
    expect(result.flows.P4).toBeCloseTo(0.0126217, 6);
    expect(result.flows.P3).toBeCloseTo(0.0426217, 6);
    expect(result.flows.P0).toBe(0.1);
    expect(result.initialFlows).toEqual(singleLoopGuess);
    expect(result.converged).toBe(false);
    expectContinuity(singleLoop, result.flows);
  });

  it('uses the signed sum of head losses, not the sum of absolute values', () => {
    const signed = step.rows.reduce((sum, row) => sum + row.headLoss, 0);
    const unsigned = step.rows.reduce((sum, row) => sum + Math.abs(row.headLoss), 0);
    expect(step.sumHeadLoss).toBeCloseTo(signed, 12);
    // Σ|hL| = 18.05 m would give ΔQ = −17.07 L/s and the method would never settle.
    expect(unsigned).toBeCloseTo(18.0456, 3);
    expect(Math.abs(step.sumHeadLoss)).toBeLessThan(unsigned / 5);
    expect(step.deltaQ).not.toBeCloseTo(-unsigned / step.sumNHeadLossOverFlow, 4);
  });
});

describe('hardyCross: convergence', () => {
  it('balances a single loop', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess);
    expect(result.converged).toBe(true);
    expect(result.iterations.length).toBeGreaterThan(1);
    expect(result.iterations.length).toBeLessThan(15);
    expect(result.iterations.map((it) => it.iteration)).toEqual(
      result.iterations.map((_, i) => i + 1),
    );

    const last = result.iterations.at(-1)!;
    expect(last.maxDeltaQ).toBeLessThan(DEFAULT_HARDY_CROSS_OPTIONS.tolerance);

    // Guard against the unsigned sum of the predecessor app: in the balanced loop the signed
    // sum vanishes while the sum of absolute head losses stays at several metres.
    const step = last.loops[0]!;
    const unsigned = step.rows.reduce((sum, row) => sum + Math.abs(row.headLoss), 0);
    expect(Math.abs(step.sumHeadLoss)).toBeLessThan(1e-4);
    expect(unsigned).toBeGreaterThan(5);

    // Independent check with the final flows: both paths from A to D lose the same head.
    const [, p1, p2, p3, p4] = singleLoop.pipes;
    const viaB = hwLoss(p1!, result.flows.P1!) + hwLoss(p2!, result.flows.P2!);
    const viaC = hwLoss(p3!, result.flows.P3!) + hwLoss(p4!, result.flows.P4!);
    expect(viaB).toBeCloseTo(viaC, 4);
  });

  it('keeps continuity after every iteration', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess);
    for (const flows of flowsPerIteration(result)) expectContinuity(singleLoop, flows);
    expectContinuity(singleLoop, result.flows);
  });

  it('reaches the same flows from a different initial guess and loop direction', () => {
    const reference = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess, {
      tolerance: 1e-10,
    });
    const loops = findLoops(singleLoop);
    const other = hardyCross(singleLoop, loops, initialLoopFlows(singleLoop, loops), {
      tolerance: 1e-10,
    });
    expect(other.converged).toBe(true);
    for (const p of singleLoop.pipes) {
      expect(other.flows[p.id]).toBeCloseTo(reference.flows[p.id]!, 8);
    }
  });

  it('balances two loops that share a pipe', () => {
    const loops = findLoops(twoLoops);
    const result = hardyCross(twoLoops, loops, initialLoopFlows(twoLoops, loops), {
      tolerance: 1e-9,
    });
    expect(result.converged).toBe(true);

    for (const flows of flowsPerIteration(result)) expectContinuity(twoLoops, flows);

    const first = result.iterations[0]!;
    const last = result.iterations.at(-1)!;
    last.loops.forEach((step, i) => {
      expect(Math.abs(step.sumHeadLoss)).toBeLessThan(1e-5);
      expect(Math.abs(step.sumHeadLoss)).toBeLessThan(Math.abs(first.loops[i]!.sumHeadLoss));
    });

    // Independent check of both loops with the final flows.
    const byId = new Map(twoLoops.pipes.map((p) => [p.id, p]));
    for (const loop of loops) {
      const sum = loop.pipes.reduce(
        (total, lp) =>
          total + lp.direction * hwLoss(byId.get(lp.pipeId)!, result.flows[lp.pipeId]!),
        0,
      );
      expect(Math.abs(sum)).toBeLessThan(1e-5);
    }
  });

  it('gives a shared pipe both corrections with opposite signs', () => {
    const loops = findLoops(twoLoops);
    const initial = initialLoopFlows(twoLoops, loops);
    const result = hardyCross(twoLoops, loops, initial, { maxIterations: 3 });

    let before = initial.P25!;
    for (const iteration of result.iterations) {
      const [first, second] = iteration.loops as [
        (typeof iteration.loops)[0],
        (typeof iteration.loops)[0],
      ];
      const inFirst = first.rows.find((r) => r.pipeId === 'P25')!;
      const inSecond = second.rows.find((r) => r.pipeId === 'P25')!;
      expect(inFirst.direction).toBe(-1);
      expect(inSecond.direction).toBe(1);

      // Both loops are evaluated with the same flow, seen with opposite signs.
      expect(inFirst.flow).toBeCloseTo(-before, 15);
      expect(inSecond.flow).toBeCloseTo(before, 15);
      expect(inFirst.headLoss).toBeCloseTo(-inSecond.headLoss, 12);

      // Pipe direction: −ΔQ of the loop it opposes, +ΔQ of the loop it follows.
      const after = before - first.deltaQ + second.deltaQ;
      expect(inSecond.correctedFlow).toBeCloseTo(after, 15);
      expect(inFirst.correctedFlow).toBeCloseTo(-after, 15);
      // Seen from the first loop: own ΔQ minus the ΔQ of the neighbour.
      expect(inFirst.correctedFlow).toBeCloseTo(inFirst.flow + first.deltaQ - second.deltaQ, 15);

      // A pipe that belongs to one loop only receives that loop's ΔQ.
      const own = first.rows.find((r) => r.pipeId === 'P14')!;
      expect(own.correctedFlow).toBeCloseTo(own.flow + first.deltaQ, 15);
      before = after;
    }
    expect(result.flows.P25).toBeCloseTo(before, 15);
  });

  it('starts each iteration from the corrected flows of the previous one', () => {
    const loops = findLoops(threeLoops);
    const result = hardyCross(threeLoops, loops, initialLoopFlows(threeLoops, loops));
    expect(result.converged).toBe(true);
    for (let i = 1; i < result.iterations.length; i++) {
      result.iterations[i]!.loops.forEach((step, loopIndex) => {
        const previous = result.iterations[i - 1]!.loops[loopIndex]!;
        expect(step.rows.map((r) => r.flow)).toEqual(previous.rows.map((r) => r.correctedFlow));
      });
    }
    for (const flows of flowsPerIteration(result)) expectContinuity(threeLoops, flows);
    for (const step of result.iterations.at(-1)!.loops) {
      expect(Math.abs(step.sumHeadLoss)).toBeLessThan(1e-3);
    }
  });

  it('reports no convergence when the iteration limit is reached', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess, {
      maxIterations: 2,
    });
    expect(result.converged).toBe(false);
    expect(result.iterations).toHaveLength(2);
  });

  it('returns the initial flows when there is no loop', () => {
    const result = hardyCross(singleLoop, [], singleLoopGuess);
    expect(result).toEqual({
      converged: true,
      iterations: [],
      initialFlows: singleLoopGuess,
      flows: singleLoopGuess,
    });
  });

  it('returns plain JSON data', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe('hardyCross: Darcy-Weisbach', () => {
  it('balances the loop with n = 2', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess, {
      formula: 'darcy-weisbach',
    });
    expect(result.converged).toBe(true);
    const first = result.iterations[0]!.loops[0]!;
    for (const row of first.rows) {
      expect(row.nHeadLossOverFlow).toBeCloseTo(
        (2 * Math.abs(row.headLoss)) / Math.abs(row.flow),
        9,
      );
      expect(Math.sign(row.headLoss)).toBe(Math.sign(row.flow));
    }
    const last = result.iterations.at(-1)!.loops[0]!;
    expect(Math.abs(last.sumHeadLoss)).toBeLessThan(1e-4);
    for (const flows of flowsPerIteration(result)) expectContinuity(singleLoop, flows);

    // Close to the Hazen-Williams split, but not the same numbers.
    const hazen = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess);
    expect(result.flows.P1).toBeCloseTo(hazen.flows.P1!, 2);
    expect(result.flows.P1).not.toBeCloseTo(hazen.flows.P1!, 6);
  });
});

describe('hardyCross: zero flow', () => {
  const withZero = { P0: 0.1, P1: 0.07, P2: 0.05, P3: 0.03, P4: 0 };

  it('handles a pipe that starts at zero flow without NaN (Hazen-Williams)', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, withZero, { tolerance: 1e-10 });
    const row = result.iterations[0]!.loops[0]!.rows.find((r) => r.pipeId === 'P4')!;
    expect(row.flow).toBe(0);
    expect(row.headLoss).toBe(0);
    expect(row.nHeadLossOverFlow).toBe(0);
    expect(Object.is(row.flow, -0)).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/null/);
    expect(result.converged).toBe(true);

    const reference = hardyCross(singleLoop, singleLoopClockwise, singleLoopGuess, {
      tolerance: 1e-10,
    });
    expect(result.flows.P4).toBeCloseTo(reference.flows.P4!, 8);
  });

  it('uses the derivative of the head loss for a pipe at zero flow (Darcy-Weisbach)', () => {
    const result = hardyCross(singleLoop, singleLoopClockwise, withZero, {
      formula: 'darcy-weisbach',
    });
    const row = result.iterations[0]!.loops[0]!.rows.find((r) => r.pipeId === 'P4')!;
    expect(row.headLoss).toBe(0);
    expect(row.nHeadLossOverFlow).toBeGreaterThan(0);
    expect(result.converged).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/null/);
  });

  it('gives ΔQ = 0 when the whole loop is at rest', () => {
    const idle = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 };
    const result = hardyCross(singleLoop, singleLoopClockwise, idle);
    expect(result.converged).toBe(true);
    expect(result.iterations).toHaveLength(1);
    expect(result.iterations[0]!.loops[0]!).toMatchObject({
      sumHeadLoss: 0,
      sumNHeadLossOverFlow: 0,
      deltaQ: 0,
    });
    expect(result.flows).toEqual(idle);
  });
});

describe('hardyCross: invalid input', () => {
  it('throws when a pipe has no initial flow', () => {
    expect(() => hardyCross(singleLoop, singleLoopClockwise, { P0: 0.1 })).toThrow(
      /missing initial flow for pipe P1/,
    );
    expect(() =>
      hardyCross(singleLoop, singleLoopClockwise, { ...singleLoopGuess, P4: Number.NaN }),
    ).toThrow(/missing initial flow for pipe P4/);
  });

  it('throws when a loop names an unknown pipe', () => {
    const loops: Loop[] = [{ id: 'X', pipes: [{ pipeId: 'P99', direction: 1 }] }];
    expect(() => hardyCross(singleLoop, loops, singleLoopGuess)).toThrow(
      /loop X refers to unknown pipe P99/,
    );
  });

  it('throws instead of returning NaN when a head loss is not finite', () => {
    const broken: Network = {
      ...singleLoop,
      pipes: singleLoop.pipes.map((p) => (p.id === 'P4' ? { ...p, diameter: 0 } : p)),
    };
    expect(() => hardyCross(broken, singleLoopClockwise, singleLoopGuess)).toThrow(/non-finite/);
  });
});
