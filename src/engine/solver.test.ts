import { hazenWilliamsHeadLoss } from './headloss';
import { pumpHead } from './pump';
import { DEFAULT_SOLVE_OPTIONS, solveNetwork } from './solver';
import {
  branchedNetwork,
  loopHeadLoss,
  makePipe,
  maxContinuityError,
  maxEnergyError,
  PUMPED_LOOPS,
  pumpedNetwork,
  TWO_LOOP_LOOPS,
  twoLoopNetwork,
} from './testing/networks';
import type { HeadLossFormula, Network } from './types';

const FORMULAS: HeadLossFormula[] = ['hazen-williams', 'darcy-weisbach'];

/** Reservoir at 100 m feeding one junction (elevation 50 m, 10 L/s) through 100 m of DN 100. */
function singlePipe(): Network {
  return {
    reservoirs: [{ id: 'R', head: 100 }],
    junctions: [{ id: 'J', elevation: 50, demand: 0.01 }],
    pipes: [makePipe('P', 'R', 'J', 100, 0.1, 140, 0.0001)],
    pumps: [],
  };
}

describe('solveNetwork: single pipe', () => {
  // Continuity fixes Q = 0.010 m³/s. Hazen-Williams (see headloss.test.ts):
  //   J = 10.643 · 0.01^1.852 / (140^1.852 · 0.1^4.87) = 0.0165362 m/m, hL = 1.65362 m
  //   head at J = 100 − 1.65362 = 98.34638 m, pressure = 98.34638 − 50 = 48.34638 m
  //   V = 0.01 / (π · 0.1² / 4) = 1.27324 m/s
  it('matches the hand computation with Hazen-Williams', () => {
    const result = solveNetwork(singlePipe());
    expect(result.converged).toBe(true);
    expect(result.formula).toBe('hazen-williams');
    expect(result.residual).toBeLessThan(DEFAULT_SOLVE_OPTIONS.flowTolerance);
    expect(result.iterations).toBeLessThanOrEqual(3);

    expect(result.nodes.J).toMatchObject({ id: 'J', elevation: 50, demand: 0.01 });
    expect(result.nodes.J!.head).toBeCloseTo(98.34638, 5);
    expect(result.nodes.J!.pressure).toBeCloseTo(48.34638, 5);

    const pipe = result.pipes.P!;
    expect(pipe.id).toBe('P');
    expect(pipe.flow).toBeCloseTo(0.01, 12);
    expect(pipe.velocity).toBeCloseTo(1.27324, 5);
    expect(pipe.headLoss).toBeCloseTo(1.65362, 5);
    expect(pipe.unitHeadLoss).toBeCloseTo(0.0165362, 7);
    expect(pipe.frictionFactor).toBeUndefined();
    expect(pipe.reynolds).toBeUndefined();
    expect(result.pumps).toEqual({});
  });

  it('reports the reservoir with elevation = head, zero pressure and its outflow as demand', () => {
    const result = solveNetwork(singlePipe());
    expect(result.nodes.R).toMatchObject({ id: 'R', head: 100, elevation: 100, pressure: 0 });
    expect(result.nodes.R!.demand).toBeCloseTo(0.01, 12);
  });

  // Darcy-Weisbach with ε = 0.1 mm and ν = 1e−6 m²/s (see headloss.test.ts):
  //   Re = 127 324, f = 0.021709, hf = 0.021709 · 1000 · 0.0826551 = 1.7943 m
  it('matches the hand computation with Darcy-Weisbach', () => {
    const result = solveNetwork(singlePipe(), {
      formula: 'darcy-weisbach',
      kinematicViscosity: 1e-6,
    });
    expect(result.converged).toBe(true);
    expect(result.formula).toBe('darcy-weisbach');
    expect(result.nodes.J!.head).toBeCloseTo(100 - 1.7943, 4);
    expect(result.pipes.P!.headLoss).toBeCloseTo(1.7943, 4);
    expect(result.pipes.P!.frictionFactor).toBeCloseTo(0.021709, 5);
    expect(result.pipes.P!.reynolds).toBeCloseTo(127324, 0);
  });

  it('gives negative flow, velocity and head loss when the pipe is drawn against the flow', () => {
    const network = singlePipe();
    network.pipes = [makePipe('P', 'J', 'R', 100, 0.1)];
    const result = solveNetwork(network);
    expect(result.pipes.P!.flow).toBeCloseTo(-0.01, 12);
    expect(result.pipes.P!.velocity).toBeCloseTo(-1.27324, 5);
    expect(result.pipes.P!.headLoss).toBeCloseTo(-1.65362, 5);
    expect(result.pipes.P!.unitHeadLoss).toBeCloseTo(0.0165362, 7);
    expect(result.nodes.J!.head).toBeCloseTo(98.34638, 5);
    expect(result.nodes.R!.demand).toBeCloseTo(0.01, 12);
  });

  it('does not modify the network and returns plain JSON data', () => {
    const network = singlePipe();
    const copy = structuredClone(network);
    const result = solveNetwork(network);
    expect(network).toEqual(copy);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('uses the default options for the fields that are not given', () => {
    expect(DEFAULT_SOLVE_OPTIONS).toMatchObject({ formula: 'hazen-williams', maxIterations: 100 });
    const defaults = solveNetwork(singlePipe());
    const partial = solveNetwork(singlePipe(), { flowTolerance: 1e-6 });
    expect(partial.nodes.J!.head).toBeCloseTo(defaults.nodes.J!.head, 9);
  });
});

describe('solveNetwork: branched network', () => {
  // Flows by continuity, from the ends towards the reservoir (L/s):
  //   P4 = 2.5,  P3 = 1.5 + 2.5 = 4.0,  P2 = 3.0,  P1 = 2.0 + 3.0 + 4.0 = 9.0
  // Hazen-Williams head losses, J = 10.643·Q^1.852/(C^1.852·D^4.87):
  //   P1: Q^1.852 = 1.62651e−4, C^1.852 = 9432.55, D^4.87 = 9.71772e−5 → J = 1.88855e−3, hL = 0.56656
  //   P2: Q^1.852 = 2.12632e−5, C^1.852 = 9432.55, D^4.87 = 3.32314e−6 → J = 7.21963e−3, hL = 1.44393
  //   P3: Q^1.852 = 3.62256e−5, C^1.852 = 9432.55, D^4.87 = 1.34896e−5 → J = 3.03005e−3, hL = 0.75751
  //   P4: Q^1.852 = 1.51700e−5, C^1.852 = 8222.86, D^4.87 = 3.32314e−6 → J = 5.90850e−3, hL = 0.88628
  // Heads:
  //   J1 = 100 − 0.56656 = 99.43344        J2 = 99.43344 − 1.44393 = 97.98951
  //   J3 = 99.43344 − 0.75751 = 98.67593   J4 = 98.67593 − 0.88628 = 97.78965
  it('matches flows from continuity and hand-computed heads', () => {
    const network = branchedNetwork();
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);

    expect(result.pipes.P1!.flow).toBeCloseTo(0.009, 12);
    expect(result.pipes.P2!.flow).toBeCloseTo(0.003, 12);
    expect(result.pipes.P3!.flow).toBeCloseTo(0.004, 12);
    expect(result.pipes.P4!.flow).toBeCloseTo(0.0025, 12);

    expect(result.pipes.P1!.headLoss).toBeCloseTo(0.56656, 5);
    expect(result.pipes.P2!.headLoss).toBeCloseTo(1.44393, 5);
    expect(result.pipes.P3!.headLoss).toBeCloseTo(0.75751, 5);
    expect(result.pipes.P4!.headLoss).toBeCloseTo(0.88628, 5);

    expect(result.nodes.J1!.head).toBeCloseTo(99.43344, 4);
    expect(result.nodes.J2!.head).toBeCloseTo(97.98951, 4);
    expect(result.nodes.J3!.head).toBeCloseTo(98.67593, 4);
    expect(result.nodes.J4!.head).toBeCloseTo(97.78965, 4);
    expect(result.nodes.J4!.pressure).toBeCloseTo(47.78965, 4);
    expect(result.nodes.R!.demand).toBeCloseTo(0.009, 12);
  });

  it.each(FORMULAS)('satisfies continuity and the energy equation with %s', (formula) => {
    const network = branchedNetwork();
    const result = solveNetwork(network, { formula });
    expect(result.converged).toBe(true);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
    expect(maxEnergyError(network, result)).toBeLessThan(1e-9);
  });
});

describe('solveNetwork: looped networks', () => {
  it.each(FORMULAS)('two loops with %s: continuity at every junction', (formula) => {
    const network = twoLoopNetwork();
    const result = solveNetwork(network, { formula });
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(10);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
    // All the demand comes from the reservoir: 4 + 3 + 5 + 6 + 7 = 25 L/s.
    expect(result.nodes.R!.demand).toBeCloseTo(0.025, 12);
    expect(result.pipes.P0!.flow).toBeCloseTo(0.025, 12);
  });

  it.each(FORMULAS)('two loops with %s: head losses add up to zero round each loop', (formula) => {
    const network = twoLoopNetwork();
    const result = solveNetwork(network, { formula });
    for (const loop of TWO_LOOP_LOOPS) {
      expect(Math.abs(loopHeadLoss(loop, result))).toBeLessThan(1e-9);
    }
    expect(maxEnergyError(network, result)).toBeLessThan(1e-9);
  });

  it.each(FORMULAS)('two loops with %s: every junction is below the reservoir', (formula) => {
    const result = solveNetwork(twoLoopNetwork(), { formula });
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const node = result.nodes[id]!;
      expect(node.head).toBeLessThan(80);
      expect(node.pressure).toBeCloseTo(node.head - node.elevation, 12);
    }
  });

  // Two identical pipes in parallel share the flow equally: 5 L/s each.
  //   J = 10.643 · 0.005^1.852 / (140^1.852 · 0.1^4.87)
  //     = 10.643 · 5.47637e−5 / 0.1272416 = 4.58065e−3 m/m, hL = 0.458065 m over 100 m
  it('splits the flow equally between two identical parallel pipes', () => {
    const network = singlePipe();
    network.pipes = [makePipe('PA', 'R', 'J', 100, 0.1), makePipe('PB', 'J', 'R', 100, 0.1)];
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.pipes.PA!.flow).toBeCloseTo(0.005, 12);
    expect(result.pipes.PB!.flow).toBeCloseTo(-0.005, 12);
    expect(result.nodes.J!.head).toBeCloseTo(100 - 0.458065, 5);
    expect(result.pipes.PA!.headLoss + result.pipes.PB!.headLoss).toBeCloseTo(0, 10);
  });

  it('sends more flow through the larger of two parallel pipes', () => {
    const network = singlePipe();
    network.pipes = [makePipe('PA', 'R', 'J', 100, 0.1), makePipe('PB', 'R', 'J', 100, 0.075)];
    const result = solveNetwork(network);
    // Equal head loss in both: Q is proportional to D^(4.87/1.852), so QA/QB = (4/3)^2.6296.
    expect(result.pipes.PA!.flow / result.pipes.PB!.flow).toBeCloseTo(
      Math.pow(0.1 / 0.075, 4.87 / 1.852),
      8,
    );
    expect(result.pipes.PA!.flow + result.pipes.PB!.flow).toBeCloseTo(0.01, 12);
  });
});

describe('solveNetwork: several reservoirs', () => {
  // R1 (100 m) ── J ── R2 (90 m), two identical pipes (100 m, DN 100, C = 140), no demand.
  // By symmetry each pipe loses 5 m, so J is at 95 m. With hL = 1.65362 m at 10 L/s:
  //   Q = 0.010 · (5 / 1.65362)^(1/1.852) = 0.010 · 3.02367^0.539957 = 0.0181747 m³/s
  it('matches the hand computation for flow between two reservoirs', () => {
    const network: Network = {
      reservoirs: [
        { id: 'R1', head: 100 },
        { id: 'R2', head: 90 },
      ],
      junctions: [{ id: 'J', elevation: 70, demand: 0 }],
      pipes: [makePipe('P1', 'R1', 'J', 100, 0.1), makePipe('P2', 'J', 'R2', 100, 0.1)],
      pumps: [],
    };
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.nodes.J!.head).toBeCloseTo(95, 9);
    expect(result.pipes.P1!.flow).toBeCloseTo(0.0181747, 6);
    expect(result.pipes.P2!.flow).toBeCloseTo(result.pipes.P1!.flow, 12);
    expect(hazenWilliamsHeadLoss(result.pipes.P1!.flow, 140, 0.1, 100)).toBeCloseTo(5, 9);
    // The upper reservoir supplies the network and the lower one receives the same flow.
    expect(result.nodes.R1!.demand).toBeCloseTo(0.0181747, 6);
    expect(result.nodes.R2!.demand).toBeCloseTo(-0.0181747, 6);
    expect(result.nodes.R2).toMatchObject({ head: 90, elevation: 90, pressure: 0 });
  });

  it('solves a pipe that joins two reservoirs directly, with no junction at all', () => {
    const network: Network = {
      reservoirs: [
        { id: 'R1', head: 100 },
        { id: 'R2', head: 95 },
      ],
      junctions: [],
      pipes: [makePipe('P', 'R1', 'R2', 100, 0.1)],
      pumps: [],
    };
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.pipes.P!.headLoss).toBeCloseTo(5, 9);
    expect(result.pipes.P!.flow).toBeCloseTo(0.0181747, 6);
  });

  it.each(FORMULAS)('two reservoirs feeding a loop with %s', (formula) => {
    const network = twoLoopNetwork();
    network.reservoirs.push({ id: 'R2', head: 78 });
    network.pipes.push(makePipe('P8', 'R2', 'F', 400, 0.15));
    const result = solveNetwork(network, { formula });
    expect(result.converged).toBe(true);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
    expect(maxEnergyError(network, result)).toBeLessThan(1e-9);
    for (const loop of TWO_LOOP_LOOPS) {
      expect(Math.abs(loopHeadLoss(loop, result))).toBeLessThan(1e-9);
    }
    // Both reservoirs supply, and together they deliver the total demand of 25 L/s.
    expect(result.nodes.R!.demand).toBeGreaterThan(0);
    expect(result.nodes.R2!.demand).toBeGreaterThan(0);
    expect(result.nodes.R!.demand + result.nodes.R2!.demand).toBeCloseTo(0.025, 12);
  });
});

describe('solveNetwork: pumps', () => {
  const curve = { a: 50, b: 50000, c: 2 };

  // Reservoir at 5 m, pump straight into a junction that draws 15 L/s:
  //   pump head = 50 − 50 000 · 0.015² = 50 − 11.25 = 38.75 m, head at J = 5 + 38.75 = 43.75 m
  it('matches the hand computation for a pump with a known flow', () => {
    const network: Network = {
      reservoirs: [{ id: 'R', head: 5 }],
      junctions: [{ id: 'J', elevation: 5, demand: 0.015 }],
      pipes: [],
      pumps: [{ id: 'PU', from: 'R', to: 'J', curve }],
    };
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.pumps.PU).toMatchObject({ id: 'PU' });
    expect(result.pumps.PU!.flow).toBeCloseTo(0.015, 12);
    expect(result.pumps.PU!.head).toBeCloseTo(38.75, 9);
    expect(result.nodes.J!.head).toBeCloseTo(43.75, 9);
    expect(result.nodes.R!.demand).toBeCloseTo(0.015, 12);
  });

  // Pump lifting from R1 (10 m) to R2 (40 m) through 500 m of DN 150. The operating point is the
  // intersection of the pump curve with the system curve, 30 + K·Q^1.852.
  it.each(FORMULAS)('finds the operating point against a static lift with %s', (formula) => {
    const network: Network = {
      reservoirs: [
        { id: 'R1', head: 10 },
        { id: 'R2', head: 40 },
      ],
      junctions: [{ id: 'J', elevation: 10, demand: 0 }],
      pipes: [makePipe('P', 'J', 'R2', 500, 0.15)],
      pumps: [{ id: 'PU', from: 'R1', to: 'J', curve }],
    };
    const result = solveNetwork(network, { formula });
    expect(result.converged).toBe(true);
    const pump = result.pumps.PU!;
    expect(pump.flow).toBeGreaterThan(0);
    expect(pump.flow).toBeCloseTo(result.pipes.P!.flow, 12);
    expect(pump.head).toBeCloseTo(pumpHead(curve, pump.flow), 9);
    expect(pump.head).toBeCloseTo(30 + result.pipes.P!.headLoss, 9);
    expect(result.nodes.J!.head).toBeCloseTo(10 + pump.head, 9);
    if (formula === 'hazen-williams') {
      expect(result.pipes.P!.headLoss).toBeCloseTo(
        hazenWilliamsHeadLoss(pump.flow, 140, 0.15, 500),
        9,
      );
    }
  });

  it.each(FORMULAS)('pump feeding a loop and an elevated reservoir with %s', (formula) => {
    const network = pumpedNetwork();
    const result = solveNetwork(network, { formula });
    expect(result.converged).toBe(true);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
    expect(maxEnergyError(network, result)).toBeLessThan(1e-9);
    for (const loop of PUMPED_LOOPS) {
      expect(Math.abs(loopHeadLoss(loop, result))).toBeLessThan(1e-9);
    }
    const pump = result.pumps.PU!;
    expect(pump.head).toBeCloseTo(pumpHead(network.pumps[0]!.curve, pump.flow), 9);
    expect(result.nodes.J1!.head - result.nodes.R1!.head).toBeCloseTo(pump.head, 9);
    // Pump delivery = demands (12 L/s) + what goes on to the upper reservoir.
    expect(pump.flow).toBeCloseTo(0.012 - result.nodes.R2!.demand, 12);
  });

  it('turns into a resistance beyond the runout flow', () => {
    // Runout flow = (50 / 50 000)^0.5 = 31.6 L/s; the demand forces 40 L/s through the pump.
    //   head added = 50 − 50 000 · 0.04² = −30 m
    const network: Network = {
      reservoirs: [{ id: 'R', head: 100 }],
      junctions: [{ id: 'J', elevation: 0, demand: 0.04 }],
      pipes: [],
      pumps: [{ id: 'PU', from: 'R', to: 'J', curve }],
    };
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.pumps.PU!.head).toBeCloseTo(-30, 9);
    expect(result.nodes.J!.head).toBeCloseTo(70, 9);
  });

  it('reports reverse flow when the downstream head exceeds the shutoff head', () => {
    // The upper reservoir stands 80 m above the suction level, more than the 50 m shutoff head.
    const network = pumpedNetwork();
    network.reservoirs[1]!.head = 90;
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    const pump = result.pumps.PU!;
    expect(pump.flow).toBeLessThan(0);
    expect(pump.head).toBeGreaterThan(50);
    expect(pump.head).toBeCloseTo(50 + 50000 * pump.flow * pump.flow, 9);
    expect(result.nodes.J1!.head - result.nodes.R1!.head).toBeCloseTo(pump.head, 9);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
  });

  it('converges with a pump curve whose exponent is below 1', () => {
    const network = pumpedNetwork();
    network.pumps[0]!.curve = { a: 50, b: 500, c: 0.6 };
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(maxContinuityError(network, result)).toBeLessThan(1e-12);
    expect(result.pumps.PU!.head).toBeCloseTo(
      pumpHead(network.pumps[0]!.curve, result.pumps.PU!.flow),
      9,
    );
  });
});

describe('solveNetwork: zero and very small demand', () => {
  const withoutDemand = (network: Network): Network => ({
    ...network,
    junctions: network.junctions.map((junction) => ({ ...junction, demand: 0 })),
  });

  it.each(FORMULAS)('%s: heads equal the reservoir head when nothing is drawn', (formula) => {
    for (const [network, head] of [
      [branchedNetwork(), 100],
      [twoLoopNetwork(), 80],
    ] as const) {
      const still = withoutDemand(network);
      const result = solveNetwork(still, { formula });
      expect(result.converged).toBe(true);
      expect(result.residual).toBe(0);
      for (const junction of still.junctions) {
        const node = result.nodes[junction.id]!;
        expect(node.head).toBeCloseTo(head, 9);
        expect(node.pressure).toBeCloseTo(head - junction.elevation, 9);
        expect(node.demand).toBe(0);
      }
      for (const pipe of still.pipes) {
        expect(Math.abs(result.pipes[pipe.id]!.flow)).toBeLessThan(1e-8);
        expect(Math.abs(result.pipes[pipe.id]!.headLoss)).toBeLessThan(1e-9);
        expect(Number.isFinite(result.pipes[pipe.id]!.unitHeadLoss)).toBe(true);
      }
      expect(Math.abs(result.nodes.R!.demand)).toBeLessThan(1e-8);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    }
  });

  it('zero demand on a single junction', () => {
    const network = withoutDemand({
      reservoirs: [{ id: 'R', head: 100 }],
      junctions: [{ id: 'J', elevation: 50, demand: 0 }],
      pipes: [makePipe('P', 'R', 'J', 100, 0.1)],
      pumps: [],
    });
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.nodes.J!.head).toBe(100);
    expect(result.pipes.P!.flow).toBe(0);
    expect(result.pipes.P!.velocity).toBe(0);
    expect(result.pipes.P!.headLoss).toBe(0);
  });

  it.each(FORMULAS)('%s: converges for demands ten thousand times smaller', (formula) => {
    for (const base of [branchedNetwork(), twoLoopNetwork()]) {
      const network: Network = {
        ...base,
        junctions: base.junctions.map((junction) => ({
          ...junction,
          demand: junction.demand * 1e-4,
        })),
      };
      const result = solveNetwork(network, { formula });
      expect(result.converged).toBe(true);
      expect(maxContinuityError(network, result)).toBeLessThan(1e-16);
      expect(maxEnergyError(network, result)).toBeLessThan(1e-9);
    }
  });

  it('handles a junction that supplies water (negative demand)', () => {
    const network = singlePipe();
    network.junctions[0]!.demand = -0.01;
    const result = solveNetwork(network);
    expect(result.converged).toBe(true);
    expect(result.pipes.P!.flow).toBeCloseTo(-0.01, 12);
    expect(result.nodes.J!.head).toBeCloseTo(100 + 1.65362, 5);
    expect(result.nodes.R!.demand).toBeCloseTo(-0.01, 12);
  });
});

describe('solveNetwork: convergence limit', () => {
  it('returns converged = false when maxIterations is 1', () => {
    const result = solveNetwork(twoLoopNetwork(), { maxIterations: 1 });
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(1);
    expect(result.residual).toBeGreaterThan(DEFAULT_SOLVE_OPTIONS.flowTolerance);
    // The result is still complete and serialisable.
    expect(Object.keys(result.nodes)).toHaveLength(7);
    expect(Object.keys(result.pipes)).toHaveLength(8);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('stops at the iteration limit and reports how many iterations ran', () => {
    const result = solveNetwork(twoLoopNetwork(), { maxIterations: 2 });
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(2);
  });

  it('a looser tolerance needs fewer iterations', () => {
    const tight = solveNetwork(twoLoopNetwork(), { flowTolerance: 1e-12 });
    const loose = solveNetwork(twoLoopNetwork(), { flowTolerance: 1e-2 });
    expect(tight.converged).toBe(true);
    expect(loose.converged).toBe(true);
    expect(loose.iterations).toBeLessThan(tight.iterations);
  });
});

describe('solveNetwork: invalid input', () => {
  const edit = (change: (network: Network) => void): Network => {
    const network = branchedNetwork();
    change(network);
    return network;
  };

  it.each<[string, Network, RegExp]>([
    ['no reservoir', edit((n) => (n.reservoirs = [])), /at least one reservoir/],
    [
      'pipe from an unknown node',
      edit((n) => (n.pipes[1]!.from = 'nowhere')),
      /pipe "P2" starts at unknown node "nowhere"/,
    ],
    [
      'pipe to an unknown node',
      edit((n) => (n.pipes[1]!.to = 'nowhere')),
      /pipe "P2" ends at unknown node "nowhere"/,
    ],
    [
      'pump at an unknown node',
      edit((n) => n.pumps.push({ id: 'PU', from: 'R', to: 'X', curve: { a: 10, b: 100, c: 2 } })),
      /pump "PU" ends at unknown node "X"/,
    ],
    [
      'junction not connected to any reservoir',
      edit((n) => (n.pipes = n.pipes.filter((p) => p.id !== 'P3'))),
      /junction "J3" is not connected to any reservoir/,
    ],
    [
      'junction with no link at all',
      edit((n) => n.junctions.push({ id: 'alone', elevation: 0, demand: 0 })),
      /junction "alone" is not connected/,
    ],
    ['zero length', edit((n) => (n.pipes[0]!.length = 0)), /pipe "P1" must have a positive length/],
    [
      'negative length',
      edit((n) => (n.pipes[0]!.length = -5)),
      /pipe "P1" must have a positive length/,
    ],
    [
      'zero diameter',
      edit((n) => (n.pipes[2]!.diameter = 0)),
      /pipe "P3" must have a positive diameter/,
    ],
    [
      'non-finite diameter',
      edit((n) => (n.pipes[2]!.diameter = Number.NaN)),
      /pipe "P3" must have a positive diameter/,
    ],
    [
      'non-positive Hazen-Williams coefficient',
      edit((n) => (n.pipes[0]!.hazenWilliamsC = 0)),
      /positive Hazen-Williams coefficient/,
    ],
    [
      'pipe from a node to itself',
      edit((n) => (n.pipes[0]!.to = 'R')),
      /pipe "P1" connects node "R" to itself/,
    ],
    [
      'duplicate junction id',
      edit((n) => n.junctions.push({ ...n.junctions[0]! })),
      /duplicate node id "J1"/,
    ],
    [
      'reservoir id equal to a junction id',
      edit((n) => n.reservoirs.push({ id: 'J2', head: 10 })),
      /duplicate node id "J2"/,
    ],
    ['duplicate pipe id', edit((n) => n.pipes.push({ ...n.pipes[0]! })), /duplicate pipe id "P1"/],
    [
      'duplicate pump id',
      edit((n) => {
        const pump = { id: 'PU', from: 'R', to: 'J1', curve: { a: 10, b: 100, c: 2 } };
        n.pumps.push(pump, { ...pump });
      }),
      /duplicate pump id "PU"/,
    ],
    [
      'non-finite demand',
      edit((n) => (n.junctions[0]!.demand = Number.NaN)),
      /junction "J1" needs a finite elevation and demand/,
    ],
    [
      'non-finite reservoir head',
      edit((n) => (n.reservoirs[0]!.head = Number.POSITIVE_INFINITY)),
      /reservoir "R" needs a finite head/,
    ],
    [
      'pump curve without positive coefficients',
      edit((n) => n.pumps.push({ id: 'PU', from: 'R', to: 'J1', curve: { a: 10, b: 0, c: 2 } })),
      /pump "PU" needs a curve/,
    ],
  ])('throws for %s', (_name, network, message) => {
    expect(() => solveNetwork(network)).toThrow(message);
  });

  it('checks the roughness only for Darcy-Weisbach', () => {
    const network = edit((n) => (n.pipes[0]!.roughness = -1));
    expect(() => solveNetwork(network)).not.toThrow();
    expect(() => solveNetwork(network, { formula: 'darcy-weisbach' })).toThrow(
      /pipe "P1" must have a non-negative roughness/,
    );
  });

  it('checks the Hazen-Williams coefficient only for Hazen-Williams', () => {
    const network = edit((n) => (n.pipes[0]!.hazenWilliamsC = 0));
    expect(() => solveNetwork(network, { formula: 'darcy-weisbach' })).not.toThrow();
  });

  it('rejects invalid options', () => {
    const network = branchedNetwork();
    expect(() => solveNetwork(network, { maxIterations: 0 })).toThrow(/maxIterations/);
    expect(() => solveNetwork(network, { maxIterations: 2.5 })).toThrow(/maxIterations/);
    expect(() => solveNetwork(network, { flowTolerance: 0 })).toThrow(/flowTolerance/);
    expect(() =>
      solveNetwork(network, { formula: 'darcy-weisbach', kinematicViscosity: 0 }),
    ).toThrow(/kinematicViscosity/);
    expect(() => solveNetwork(network, { formula: 'manning' as HeadLossFormula })).toThrow(
      /unknown head loss formula "manning"/,
    );
  });
});
