// @vitest-environment node
import { reynoldsNumber, swameeJainFrictionFactor } from './headloss';
import { fitPumpCurve, pumpHead } from './pump';
import { solveNetwork } from './solver';
import {
  EPANET_HW_CONSTANT,
  epanetEquivalentC,
  solveWithEpanet,
  type EpanetSolution,
} from './testing/epanet';
import { branchedNetwork, makePipe, pumpedNetwork, twoLoopNetwork } from './testing/networks';
import type { Network, PumpCurvePoint, SolveResult } from './types';
import { GRAVITY, pipeArea, WATER_KINEMATIC_VISCOSITY } from './units';

/**
 * Cross-validation of the solver against EPANET 2.3 (epanet-js, MIT licence, devDependency).
 *
 * Hazen-Williams. EPANET's formula written in SI is 10.667·L·Q^1.852/(C^1.852·D^4.871), ours is
 * 10.643·L·Q^1.852/(C^1.852·D^4.87). Our formula is not changed to match. Instead EPANET gets,
 * for each pipe, the coefficient C' that makes its formula return our head loss
 * (`epanetEquivalentC`, about 0.1 % above C). Both engines then solve the same equations, and
 * any difference left is a difference between the solvers. A second set of tests passes C
 * unchanged, to show the size of the formula difference on its own.
 *
 * Darcy-Weisbach. EPANET does not solve Colebrook-White: above Re = 4000 it uses the explicit
 * Swamee-Jain approximation, and it takes g = 32.2 ft/s² (9.8146 m/s²). The friction laws differ
 * by up to about 1 %, so that comparison uses a tolerance of that size.
 */

const HEAD_TOLERANCE = 1e-9; // m
const FLOW_TOLERANCE = 1e-12; // m³/s = 1e-9 L/s

const HW = { formula: 'hazen-williams', kinematicViscosity: WATER_KINEMATIC_VISCOSITY } as const;
const DW = { formula: 'darcy-weisbach', kinematicViscosity: WATER_KINEMATIC_VISCOSITY } as const;

function maxHeadDifference(ours: SolveResult, epanet: EpanetSolution): number {
  return Math.max(
    ...Object.keys(epanet.heads).map((id) => Math.abs(epanet.heads[id]! - ours.nodes[id]!.head)),
  );
}

function maxFlowDifference(ours: SolveResult, epanet: EpanetSolution): number {
  return Math.max(
    ...Object.keys(epanet.flows).map((id) =>
      Math.abs(epanet.flows[id]! - (ours.pipes[id] ?? ours.pumps[id])!.flow),
    ),
  );
}

const NETWORKS: [string, () => Network][] = [
  ['branched network', branchedNetwork],
  ['two-loop network', twoLoopNetwork],
  ['network with a pump and two reservoirs', pumpedNetwork],
];

describe('EPANET reference: Hazen-Williams formula', () => {
  it('EPANET evaluates 10.667·L·Q^1.852/(C^1.852·D^4.871) in SI', async () => {
    expect(EPANET_HW_CONSTANT).toBeCloseTo(10.6667, 4);
    const network: Network = {
      reservoirs: [{ id: 'R', head: 100 }],
      junctions: [{ id: 'J', elevation: 50, demand: 0.01 }],
      pipes: [makePipe('P', 'R', 'J', 100, 0.1, 140)],
      pumps: [],
    };
    const epanet = await solveWithEpanet(network, { ...HW, equivalentC: false });
    const expected =
      (EPANET_HW_CONSTANT * 100 * Math.pow(0.01, 1.852)) /
      (Math.pow(140, 1.852) * Math.pow(0.1, 4.871));
    expect(100 - epanet.heads.J!).toBeCloseTo(expected, 10);
    // 1.66112 m against our 1.65362 m for the same C: 0.45 % apart.
    expect(expected).toBeCloseTo(1.66112, 5);
  });

  it('the equivalent coefficient is about 0.1 % above C and depends weakly on the diameter', () => {
    expect(epanetEquivalentC(140, 0.1) / 140).toBeCloseTo(1.00245, 5);
    expect(epanetEquivalentC(140, 0.05) / 140).toBeGreaterThan(epanetEquivalentC(140, 0.3) / 140);
  });

  it('with the equivalent coefficient EPANET reproduces our single-pipe head loss', async () => {
    const network: Network = {
      reservoirs: [{ id: 'R', head: 100 }],
      junctions: [{ id: 'J', elevation: 50, demand: 0.01 }],
      pipes: [makePipe('P', 'R', 'J', 100, 0.1, 140)],
      pumps: [],
    };
    const epanet = await solveWithEpanet(network, HW);
    expect(100 - epanet.heads.J!).toBeCloseTo(1.6536170444, 9);
  });
});

describe('solver against EPANET: Hazen-Williams, same head loss law', () => {
  it.each(NETWORKS)('%s: heads and flows agree', async (_name, build) => {
    const network = build();
    const ours = solveNetwork(network, HW);
    const epanet = await solveWithEpanet(network, HW);
    expect(ours.converged).toBe(true);
    expect(maxHeadDifference(ours, epanet)).toBeLessThan(HEAD_TOLERANCE);
    expect(maxFlowDifference(ours, epanet)).toBeLessThan(FLOW_TOLERANCE);
  });

  it('two reservoirs feeding the two-loop network', async () => {
    const network = twoLoopNetwork();
    network.reservoirs.push({ id: 'R2', head: 78 });
    network.pipes.push(makePipe('P8', 'R2', 'F', 400, 0.15));
    const ours = solveNetwork(network, HW);
    const epanet = await solveWithEpanet(network, HW);
    expect(maxHeadDifference(ours, epanet)).toBeLessThan(HEAD_TOLERANCE);
    expect(maxFlowDifference(ours, epanet)).toBeLessThan(FLOW_TOLERANCE);
  });

  it('pump head agrees', async () => {
    const network = pumpedNetwork();
    const ours = solveNetwork(network, HW);
    const epanet = await solveWithEpanet(network, HW);
    expect(epanet.pumpHeads.PU!).toBeCloseTo(ours.pumps.PU!.head, 9);
  });
});

describe('solver against EPANET: Hazen-Williams, same C in both', () => {
  // Here the two engines use different formulas, so they cannot agree to solver precision.
  // EPANET loses 0.2 to 0.5 % more head; over these networks that is a few centimetres.
  it.each(NETWORKS)(
    '%s: differences are of the size of the formula difference',
    async (_n, build) => {
      const network = build();
      const ours = solveNetwork(network, HW);
      const epanet = await solveWithEpanet(network, { ...HW, equivalentC: false });
      const headDifference = maxHeadDifference(ours, epanet);
      expect(headDifference).toBeGreaterThan(1e-3);
      expect(headDifference).toBeLessThan(0.05);
      expect(maxFlowDifference(ours, epanet)).toBeLessThan(2e-5);
    },
  );
});

describe('pump curve fit against EPANET', () => {
  // The same three points go to both engines. EPANET fits its own H = h0 − r·Q^n; if its
  // coefficients differed from ours, the pump heads at three different flows could not all
  // agree. Flows are set through the demand of the junction on the pump discharge.
  const points: [PumpCurvePoint, PumpCurvePoint, PumpCurvePoint] = [
    { flow: 0, head: 42 },
    { flow: 0.006, head: 38 },
    { flow: 0.014, head: 22 },
  ];

  it('gives the same head at three operating points', async () => {
    const curve = fitPumpCurve(points);
    // Closed form EPANET documents for a three-point curve with a shutoff point.
    expect(curve.a).toBe(42);
    expect(curve.c).toBeCloseTo(Math.log(20 / 4) / Math.log(14 / 6), 12);
    expect(curve.b).toBeCloseTo(4 / Math.pow(0.006, curve.c), 6);

    for (const demand of [0.003, 0.009, 0.013]) {
      const network: Network = {
        reservoirs: [{ id: 'R', head: 5 }],
        junctions: [{ id: 'J', elevation: 5, demand }],
        pipes: [],
        pumps: [{ id: 'PU', from: 'R', to: 'J', curve }],
      };
      const ours = solveNetwork(network, HW);
      const epanet = await solveWithEpanet(network, { ...HW, pumpPoints: { PU: points } });
      expect(epanet.flows.PU!).toBeCloseTo(demand, 12);
      expect(epanet.pumpHeads.PU!).toBeCloseTo(pumpHead(curve, demand), 9);
      expect(epanet.heads.J!).toBeCloseTo(ours.nodes.J!.head, 9);
    }
  });

  it('agrees on the operating point of a fitted pump feeding a network', async () => {
    const network = pumpedNetwork();
    network.pumps[0]!.curve = fitPumpCurve(points);
    network.reservoirs[1]!.head = 35;
    const ours = solveNetwork(network, HW);
    const epanet = await solveWithEpanet(network, { ...HW, pumpPoints: { PU: points } });
    expect(ours.pumps.PU!.flow).toBeGreaterThan(0);
    expect(maxHeadDifference(ours, epanet)).toBeLessThan(HEAD_TOLERANCE);
    expect(maxFlowDifference(ours, epanet)).toBeLessThan(FLOW_TOLERANCE);
  });
});

describe('solver against EPANET: Darcy-Weisbach', () => {
  it.each(NETWORKS)('%s: EPANET follows Swamee-Jain with g = 32.2 ft/s²', async (_n, build) => {
    // Checks the mapping of units, roughness and viscosity used for the comparison below:
    // EPANET's own head losses are reproduced by the explicit formula at EPANET's flows.
    const network = build();
    const epanet = await solveWithEpanet(network, DW);
    const epanetGravity = 32.2 * 0.3048;
    for (const pipe of network.pipes) {
      const flow = epanet.flows[pipe.id]!;
      const reynolds = reynoldsNumber(flow, pipe.diameter, WATER_KINEMATIC_VISCOSITY);
      expect(reynolds).toBeGreaterThan(4000);
      const f = swameeJainFrictionFactor(reynolds, pipe.roughness / pipe.diameter);
      const v = flow / pipeArea(pipe.diameter);
      const headLoss = (f * (pipe.length / pipe.diameter) * v * v) / (2 * epanetGravity);
      expect(Math.abs(epanet.headLosses[pipe.id]! / headLoss - 1)).toBeLessThan(5e-5);
      // The same expression with standard gravity is 0.08 % higher.
      expect(GRAVITY / epanetGravity).toBeCloseTo(0.99919, 5);
    }
  });

  it.each(NETWORKS)('%s: heads within 0.05 m and flows within 0.02 L/s', async (_name, build) => {
    const network = build();
    const ours = solveNetwork(network, DW);
    const epanet = await solveWithEpanet(network, DW);
    expect(ours.converged).toBe(true);
    expect(maxHeadDifference(ours, epanet)).toBeLessThan(0.05);
    expect(maxFlowDifference(ours, epanet)).toBeLessThan(2e-5);
  });
});
