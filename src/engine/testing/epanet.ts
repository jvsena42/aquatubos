import {
  FlowUnits,
  HeadLossType,
  LinkProperty,
  LinkType,
  NodeProperty,
  NodeType,
  Option,
  Project,
  PumpType,
  Workspace,
} from 'epanet-js';
import {
  HAZEN_WILLIAMS_CONSTANT,
  HAZEN_WILLIAMS_DIAMETER_EXPONENT,
  HAZEN_WILLIAMS_EXPONENT,
} from '../headloss';
import type { HeadLossFormula, Network, PumpCurve, PumpCurvePoint } from '../types';

/**
 * Reference solution of a network by EPANET (through epanet-js, test use only).
 *
 * EPANET computes in US units. With LPS flow units it converts lengths with 0.3048 m/ft and
 * flows with 28.317 L/s per ft³/s, and evaluates the Hazen-Williams loss as
 *   h = 4.727 · L · Q^1.852 / (C^1.852 · D^4.871)            (ft, ft³/s).
 * Written in SI that is
 *   h = EPANET_HW_CONSTANT · L · Q^1.852 / (C^1.852 · D^4.871), EPANET_HW_CONSTANT = 10.6667,
 * against 10.643 and D^4.87 in this engine. The two formulas are not the same, so a comparison
 * with the same C would show a difference of about 0.2 to 0.5 % in head loss that has nothing to
 * do with the solver.
 */
export const EPANET_HW_CONSTANT =
  (4.727 * Math.pow(0.3048, 4.871)) / Math.pow(28.317 / 1000, HAZEN_WILLIAMS_EXPONENT);

const EPANET_HW_DIAMETER_EXPONENT = 4.871;

/**
 * Hazen-Williams coefficient to give EPANET so that its formula returns exactly the head loss
 * of this engine's formula for a pipe of the given diameter and coefficient `c`:
 *   10.643 / (C^1.852 · D^4.87) = EPANET_HW_CONSTANT / (C'^1.852 · D^4.871)
 */
export function epanetEquivalentC(c: number, diameter: number): number {
  const ratio =
    (EPANET_HW_CONSTANT / HAZEN_WILLIAMS_CONSTANT) *
    Math.pow(diameter, HAZEN_WILLIAMS_DIAMETER_EXPONENT - EPANET_HW_DIAMETER_EXPONENT);
  return c * Math.pow(ratio, 1 / HAZEN_WILLIAMS_EXPONENT);
}

/** Kinematic viscosity EPANET takes as specific viscosity 1: 1.1e−5 ft²/s, in m²/s. */
export const EPANET_REFERENCE_VISCOSITY = 1.1e-5 * 0.3048 * 0.3048;

export interface EpanetSolution {
  /** Head by node id, m. */
  heads: Record<string, number>;
  /** Flow by pipe or pump id, m³/s, positive from `from` to `to`. */
  flows: Record<string, number>;
  /** Head loss by pipe id as reported by EPANET, m (always >= 0). */
  headLosses: Record<string, number>;
  /** Head added by each pump, m. */
  pumpHeads: Record<string, number>;
}

export interface EpanetOptions {
  formula: HeadLossFormula;
  /** m²/s, Darcy-Weisbach only. */
  kinematicViscosity: number;
  /**
   * Hazen-Williams only. True (default) passes `epanetEquivalentC` so both engines evaluate the
   * same head loss law; false passes C unchanged.
   */
  equivalentC?: boolean;
  /**
   * Three curve points (SI) to give EPANET for a pump, by pump id. Defaults to the shutoff point
   * and two more points sampled from the pump's own curve.
   */
  pumpPoints?: Record<string, readonly PumpCurvePoint[]>;
}

function sampleCurve({ a, b, c }: PumpCurve): PumpCurvePoint[] {
  const runout = Math.pow(a / b, 1 / c);
  return [0, 0.4 * runout, 0.8 * runout].map((flow) => ({
    flow,
    head: a - b * Math.pow(flow, c),
  }));
}

let workspace: Promise<Workspace> | undefined;

function loadWorkspace(): Promise<Workspace> {
  workspace ??= (async () => {
    const ws = new Workspace();
    await ws.loadModule();
    return ws;
  })();
  return workspace;
}

/**
 * Builds `network` in EPANET with LPS units and solves it with the tightest convergence
 * settings the toolkit accepts.
 */
export async function solveWithEpanet(
  network: Network,
  options: EpanetOptions,
): Promise<EpanetSolution> {
  const ws = await loadWorkspace();
  const model = new Project(ws);
  const darcy = options.formula === 'darcy-weisbach';
  model.init('report.rpt', 'out.bin', FlowUnits.LPS, darcy ? HeadLossType.DW : HeadLossType.HW);
  try {
    for (const junction of network.junctions) {
      const index = model.addNode(junction.id, NodeType.Junction);
      model.setJunctionData(index, junction.elevation, junction.demand * 1000, '');
    }
    for (const reservoir of network.reservoirs) {
      const index = model.addNode(reservoir.id, NodeType.Reservoir);
      model.setNodeValue(index, NodeProperty.Elevation, reservoir.head);
    }
    for (const pipe of network.pipes) {
      const index = model.addLink(pipe.id, LinkType.Pipe, pipe.from, pipe.to);
      // EPANET takes the diameter and the Darcy-Weisbach roughness in mm.
      const roughness = darcy
        ? pipe.roughness * 1000
        : options.equivalentC === false
          ? pipe.hazenWilliamsC
          : epanetEquivalentC(pipe.hazenWilliamsC, pipe.diameter);
      model.setPipeData(index, pipe.length, pipe.diameter * 1000, roughness, 0);
    }
    for (const pump of network.pumps) {
      const index = model.addLink(pump.id, LinkType.Pump, pump.from, pump.to);
      // EPANET fits its own power function through three points of the curve.
      const points = options.pumpPoints?.[pump.id] ?? sampleCurve(pump.curve);
      const curveId = `curve-${pump.id}`;
      model.addCurve(curveId);
      const curveIndex = model.getCurveIndex(curveId);
      model.setCurve(
        curveIndex,
        points.map((point) => point.flow * 1000),
        points.map((point) => point.head),
      );
      model.setHeadCurveIndex(index, curveIndex);
    }
    if (darcy) {
      model.setOption(Option.SpViscos, options.kinematicViscosity / EPANET_REFERENCE_VISCOSITY);
    }
    model.setOption(Option.Trials, 500);
    model.setOption(Option.Accuracy, 1e-8);
    model.setOption(Option.FlowChange, 1e-9);
    model.setOption(Option.HeadError, 1e-9);
    model.solveH();
    // EPANET classifies the pump curve when the hydraulic solver opens.
    for (const pump of network.pumps) {
      if (model.getPumpType(model.getLinkIndex(pump.id)) !== PumpType.PowerFunc) {
        throw new Error(`EPANET did not fit a power function to the curve of pump ${pump.id}.`);
      }
    }

    const heads: Record<string, number> = {};
    for (const node of [...network.junctions, ...network.reservoirs]) {
      heads[node.id] = model.getNodeValue(model.getNodeIndex(node.id), NodeProperty.Head);
    }
    const flows: Record<string, number> = {};
    const pumpHeads: Record<string, number> = {};
    const headLosses: Record<string, number> = {};
    for (const pipe of network.pipes) {
      const index = model.getLinkIndex(pipe.id);
      flows[pipe.id] = model.getLinkValue(index, LinkProperty.Flow) / 1000;
      headLosses[pipe.id] = model.getLinkValue(index, LinkProperty.Headloss);
    }
    for (const pump of network.pumps) {
      const index = model.getLinkIndex(pump.id);
      flows[pump.id] = model.getLinkValue(index, LinkProperty.Flow) / 1000;
      // EPANET reports the head gain of a pump as a negative head loss.
      pumpHeads[pump.id] = -model.getLinkValue(index, LinkProperty.Headloss);
    }
    return { heads, flows, headLosses, pumpHeads };
  } finally {
    model.close();
  }
}
