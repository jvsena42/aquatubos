import { pressureCheckedJunctions } from '../../engine/checks';
import { LAMINAR_REYNOLDS, TURBULENT_REYNOLDS } from '../../engine/headloss';
import type { HeadLossFormula, PumpCurve } from '../../engine/types';
import { pipeArea } from '../../engine/units';
import type { StageEvaluation } from '../../game/types';

/**
 * Numbers behind the calculation panel. Everything is read from the evaluation (the network the
 * solver received and its result), in SI units, so the panel can never disagree with the solver.
 */

export type FlowRegime = 'laminar' | 'transition' | 'turbulent';

export interface PipeCalc {
  id: string;
  formula: HeadLossFormula;
  /** Node ids in the direction of the flow. */
  upstream: string;
  downstream: string;
  /** True when the water runs against the pipe's from → to direction. */
  reversed: boolean;
  /** m */
  length: number;
  /** m */
  diameter: number;
  hazenWilliamsC: number;
  /** m */
  roughness: number;
  /** m³/s, absolute value. */
  flow: number;
  /** m² */
  area: number;
  /** m/s, absolute value. */
  velocity: number;
  /** m/m */
  unitHeadLoss: number;
  /** m, absolute value: upstream head − downstream head. */
  headLoss: number;
  /** m */
  upstreamHead: number;
  downstreamHead: number;
  /** Darcy-Weisbach only. */
  reynolds?: number;
  relativeRoughness?: number;
  frictionFactor?: number;
  regime?: FlowRegime;
}

export function flowRegime(reynolds: number): FlowRegime {
  if (reynolds < LAMINAR_REYNOLDS) return 'laminar';
  return reynolds > TURBULENT_REYNOLDS ? 'turbulent' : 'transition';
}

export function pipeCalc(evaluation: StageEvaluation, pipeId: string): PipeCalc | null {
  const pipe = evaluation.network.pipes.find((p) => p.id === pipeId);
  const result = evaluation.result.pipes[pipeId];
  if (!pipe || !result) return null;
  const reversed = result.flow < 0;
  const upstream = reversed ? pipe.to : pipe.from;
  const downstream = reversed ? pipe.from : pipe.to;
  const upstreamHead = evaluation.result.nodes[upstream]?.head;
  const downstreamHead = evaluation.result.nodes[downstream]?.head;
  if (upstreamHead === undefined || downstreamHead === undefined) return null;

  const calc: PipeCalc = {
    id: pipe.id,
    formula: evaluation.result.formula,
    upstream,
    downstream,
    reversed,
    length: pipe.length,
    diameter: pipe.diameter,
    hazenWilliamsC: pipe.hazenWilliamsC,
    roughness: pipe.roughness,
    flow: Math.abs(result.flow),
    area: pipeArea(pipe.diameter),
    velocity: Math.abs(result.velocity),
    unitHeadLoss: result.unitHeadLoss,
    headLoss: Math.abs(result.headLoss),
    upstreamHead,
    downstreamHead,
  };
  if (calc.formula === 'darcy-weisbach') {
    calc.reynolds = result.reynolds ?? 0;
    calc.relativeRoughness = pipe.roughness / pipe.diameter;
    calc.frictionFactor = result.frictionFactor ?? 0;
    calc.regime = flowRegime(calc.reynolds);
  }
  return calc;
}

export interface LinkFlow {
  id: string;
  kind: 'pipe' | 'pump';
  /** Node at the other end of the link. */
  other: string;
  /** m³/s into the node (negative when the water leaves the node through this link). */
  inflow: number;
}

/** Signed flows of the links connected to a node, in the order of the network. */
export function linkFlows(evaluation: StageEvaluation, nodeId: string): LinkFlow[] {
  const flows: LinkFlow[] = [];
  const { network, result } = evaluation;
  const add = (
    kind: LinkFlow['kind'],
    link: { id: string; from: string; to: string },
    flow: number | undefined,
  ) => {
    if (flow === undefined) return;
    if (link.to === nodeId) flows.push({ id: link.id, kind, other: link.from, inflow: flow });
    else if (link.from === nodeId) flows.push({ id: link.id, kind, other: link.to, inflow: -flow });
  };
  for (const pipe of network.pipes) add('pipe', pipe, result.pipes[pipe.id]?.flow);
  for (const pump of network.pumps) add('pump', pump, result.pumps[pump.id]?.flow);
  return flows;
}

export interface NodeCalc {
  id: string;
  /** m */
  elevation: number;
  /** m³/s */
  demand: number;
  /** Hydraulic grade, m. */
  head: number;
  /** Dynamic pressure head, m. */
  pressure: number;
  /** Static pressure head, m. Undefined when no reservoir reaches the node. */
  staticPressure?: number;
  /** Static level = elevation + static pressure, m. */
  staticLevel?: number;
  /** False for a pump discharge node without demand: the pressure limits do not apply. */
  pressureChecked: boolean;
  links: LinkFlow[];
  /** Σ of the flows that enter the node, m³/s. */
  inflow: number;
  /** Σ of the flows that leave the node through links, m³/s. */
  outflow: number;
  /** inflow − outflow − demand, m³/s: zero when continuity holds. */
  residual: number;
}

export function nodeCalc(evaluation: StageEvaluation, nodeId: string): NodeCalc | null {
  const junction = evaluation.network.junctions.find((j) => j.id === nodeId);
  const result = evaluation.result.nodes[nodeId];
  if (!junction || !result) return null;
  const links = linkFlows(evaluation, nodeId);
  const inflow = links.reduce((sum, link) => sum + Math.max(link.inflow, 0), 0);
  const outflow = links.reduce((sum, link) => sum + Math.max(-link.inflow, 0), 0);
  const staticPressure = evaluation.report.staticPressure[nodeId];
  return {
    id: nodeId,
    elevation: junction.elevation,
    demand: junction.demand,
    head: result.head,
    pressure: result.pressure,
    staticPressure,
    staticLevel: staticPressure === undefined ? undefined : junction.elevation + staticPressure,
    pressureChecked: pressureCheckedJunctions(evaluation.network).some((j) => j.id === nodeId),
    links,
    inflow,
    outflow,
    residual: inflow - outflow - junction.demand,
  };
}

export interface ReservoirCalc {
  id: string;
  /** Water level = hydraulic grade, m. */
  head: number;
  links: LinkFlow[];
  /** Net flow the reservoir supplies to the network, m³/s. */
  outflow: number;
}

export function reservoirCalc(evaluation: StageEvaluation, id: string): ReservoirCalc | null {
  const reservoir = evaluation.network.reservoirs.find((r) => r.id === id);
  if (!reservoir) return null;
  const links = linkFlows(evaluation, id);
  return {
    id,
    head: reservoir.head,
    links,
    outflow: links.reduce((sum, link) => sum - link.inflow, 0),
  };
}

export interface PumpCalc {
  id: string;
  from: string;
  to: string;
  curve: PumpCurve;
  /** Operating flow, m³/s. */
  flow: number;
  /** Head added at the operating flow, m. */
  head: number;
  /** m */
  suctionHead: number;
  dischargeHead: number;
}

export function pumpCalc(evaluation: StageEvaluation, pumpId: string): PumpCalc | null {
  const pump = evaluation.network.pumps.find((p) => p.id === pumpId);
  const result = evaluation.result.pumps[pumpId];
  const suctionHead = pump && evaluation.result.nodes[pump.from]?.head;
  const dischargeHead = pump && evaluation.result.nodes[pump.to]?.head;
  if (!pump || !result || suctionHead === undefined || dischargeHead === undefined) return null;
  return {
    id: pumpId,
    from: pump.from,
    to: pump.to,
    curve: pump.curve,
    flow: result.flow,
    head: result.head,
    suctionHead,
    dischargeHead,
  };
}
