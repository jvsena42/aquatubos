import { fitPumpCurve } from '../engine/pump';
import type { HeadLossFormula, Network, PumpCurvePoint } from '../engine/types';
import { lpsToM3s, mmToM } from '../engine/units';
import type { Diameters, Scenario } from '../scenarios/types';

/** Initial DN (mm) of every pipe of a scenario. */
export function initialDiameters(scenario: Scenario): Diameters {
  return Object.fromEntries(scenario.pipes.map((p) => [p.id, p.initialDN]));
}

/**
 * Converts a scenario (display units) plus the player's diameters (DN, mm) to an SI network.
 * The internal diameter is taken equal to the nominal diameter, which keeps the numbers easy
 * to check by hand.
 */
export function buildNetwork(scenario: Scenario, diameters: Diameters): Network {
  return {
    junctions: scenario.nodes.map((n) => ({
      id: n.id,
      elevation: n.elevation,
      demand: lpsToM3s(n.demandLps),
    })),
    reservoirs: scenario.reservoirs.map((r) => ({ id: r.id, head: r.waterLevel })),
    pipes: scenario.pipes.map((p) => ({
      id: p.id,
      from: p.from,
      to: p.to,
      length: p.length,
      diameter: mmToM(diameters[p.id] ?? p.initialDN),
      hazenWilliamsC: scenario.hazenWilliamsC,
      roughness: mmToM(scenario.roughnessMm),
    })),
    pumps: scenario.pumps.map((pump) => ({
      id: pump.id,
      from: pump.from,
      to: pump.to,
      curve: fitPumpCurve(
        pump.points.map((pt) => ({ flow: lpsToM3s(pt.flowLps), head: pt.head })) as [
          PumpCurvePoint,
          PumpCurvePoint,
          PumpCurvePoint,
        ],
      ),
    })),
  };
}

export type { HeadLossFormula };
