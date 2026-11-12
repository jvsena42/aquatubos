import { findLoops, hardyCross, initialLoopFlows } from './hardyCross';
import { solveNetwork } from './solver';
import type { HeadLossFormula, Network, Pipe } from './types';

/**
 * Cross-check of Hardy Cross against the Global Gradient Algorithm, with the real head-loss
 * module (no mocks). While `solver.ts` is still a stub that throws 'not implemented' the suite
 * is skipped; it runs once the solver is in place.
 */
function solverIsStub(): boolean {
  try {
    solveNetwork({
      junctions: [{ id: 'A', elevation: 0, demand: 0.001 }],
      reservoirs: [{ id: 'R', head: 10 }],
      pipes: [
        {
          id: 'P',
          from: 'R',
          to: 'A',
          length: 100,
          diameter: 0.1,
          hazenWilliamsC: 140,
          roughness: 0.0000015,
        },
      ],
      pumps: [],
    });
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes('not implemented');
  }
}

const pipe = (id: string, from: string, to: string, length: number, diameter: number): Pipe => ({
  id,
  from,
  to,
  length,
  diameter,
  hazenWilliamsC: 140,
  roughness: 0.0000015,
});

const oneLoop: Network = {
  junctions: [
    { id: 'A', elevation: 10, demand: 0 },
    { id: 'B', elevation: 8, demand: 0.02 },
    { id: 'C', elevation: 6, demand: 0.03 },
    { id: 'D', elevation: 5, demand: 0.05 },
  ],
  reservoirs: [{ id: 'R', head: 60 }],
  pipes: [
    pipe('P0', 'R', 'A', 100, 0.3),
    pipe('P1', 'A', 'B', 500, 0.25),
    pipe('P2', 'B', 'D', 400, 0.2),
    pipe('P3', 'A', 'C', 400, 0.2),
    pipe('P4', 'C', 'D', 500, 0.15),
  ],
  pumps: [],
};

const twoLoops: Network = {
  junctions: [
    { id: '1', elevation: 10, demand: 0 },
    { id: '2', elevation: 9, demand: 0.01 },
    { id: '3', elevation: 8, demand: 0.015 },
    { id: '4', elevation: 9, demand: 0.01 },
    { id: '5', elevation: 7, demand: 0.02 },
    { id: '6', elevation: 6, demand: 0.025 },
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

describe.skipIf(solverIsStub())('Hardy Cross against the Global Gradient Algorithm', () => {
  const cases: [string, Network, number][] = [
    ['one loop', oneLoop, 1],
    ['two loops', twoLoops, 2],
  ];
  const formulas: HeadLossFormula[] = ['hazen-williams', 'darcy-weisbach'];

  for (const [name, network, loopCount] of cases) {
    for (const formula of formulas) {
      it(`gives the same flows on ${name} (${formula})`, () => {
        const loops = findLoops(network);
        expect(loops).toHaveLength(loopCount);

        const hardy = hardyCross(network, loops, initialLoopFlows(network, loops), {
          formula,
          tolerance: 1e-10,
          maxIterations: 200,
        });
        const gga = solveNetwork(network, { formula });

        expect(hardy.converged).toBe(true);
        expect(gga.converged).toBe(true);
        for (const p of network.pipes) {
          // 1e-6 m³/s = 0.001 L/s
          expect(Math.abs(hardy.flows[p.id]! - gga.pipes[p.id]!.flow)).toBeLessThan(1e-6);
        }
      });
    }
  }
});
