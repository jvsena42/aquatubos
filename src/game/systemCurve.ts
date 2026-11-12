import { pumpHead } from '../engine/pump';
import { solveNetwork } from '../engine/solver';
import type { Network, SolveOptions, SolveResult } from '../engine/types';
import type { PumpChartData, PumpChartPoint } from './types';

const SAMPLES = 24;

/**
 * Pump curve and system curve for a network fed by a single pump that draws directly from the
 * only reservoir.
 *
 * System head at flow Q: all demands are scaled so that they add up to Q, the pump discharge
 * node is held at a trial head, and the network is solved. Because every head downstream moves
 * by the same amount as the discharge head, the discharge head that leaves the worst node
 * exactly at the minimum pressure is known after one solve. Subtracting the reservoir level
 * gives the head the pump has to add.
 *
 * Returns undefined when the network does not have that simple layout.
 */
export function pumpChart(
  network: Network,
  result: SolveResult,
  minPressure: number,
  options: Partial<SolveOptions> = {},
): PumpChartData | undefined {
  const pump = network.pumps[0];
  const source = network.reservoirs[0];
  if (!pump || !source || network.pumps.length !== 1 || network.reservoirs.length !== 1) {
    return undefined;
  }
  if (pump.from !== source.id) return undefined;
  const discharge = network.junctions.find((j) => j.id === pump.to);
  if (!discharge) return undefined;

  const totalDemand = network.junctions.reduce((sum, j) => sum + j.demand, 0);
  if (totalDemand <= 0) return undefined;

  const downstream = network.junctions.filter((j) => j.id !== discharge.id);
  const trialHead = discharge.elevation + 100;

  const systemHead = (flow: number): number => {
    const staticRequirement = Math.max(...network.junctions.map((j) => j.elevation + minPressure));
    if (flow <= 0 || downstream.length === 0) return staticRequirement - source.head;
    const scale = flow / totalDemand;
    const scaled: Network = {
      junctions: downstream.map((j) => ({ ...j, demand: j.demand * scale })),
      reservoirs: [{ id: discharge.id, head: trialHead }],
      pipes: network.pipes,
      pumps: [],
    };
    const solved = solveNetwork(scaled, options);
    let deficit = discharge.elevation + minPressure - trialHead;
    for (const j of downstream) {
      const node = solved.nodes[j.id];
      if (node) deficit = Math.max(deficit, j.elevation + minPressure - node.head);
    }
    return trialHead + deficit - source.head;
  };

  // Flow range: up to where the pump head reaches zero, but at least 1.5 × the demand.
  const { a, b, c } = pump.curve;
  const runout = b > 0 ? Math.pow(a / b, 1 / c) : totalDemand * 2;
  const maxFlow = Math.max(Math.min(runout, totalDemand * 3), totalDemand * 1.5);

  const points: PumpChartPoint[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const flow = (maxFlow * i) / SAMPLES;
    points.push({
      flow,
      pumpHead: Math.max(pumpHead(pump.curve, flow), 0),
      systemHead: systemHead(flow),
    });
  }

  const pumpResult = result.pumps[pump.id];
  const operatingFlow = pumpResult?.flow ?? totalDemand;
  return {
    pumpId: pump.id,
    curve: pump.curve,
    points,
    operating: {
      flow: operatingFlow,
      head: pumpResult?.head ?? pumpHead(pump.curve, operatingFlow),
    },
    requiredHead: systemHead(operatingFlow),
  };
}
