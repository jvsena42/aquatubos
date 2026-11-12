import type { PipeResult, PumpResult } from '../../engine/types';
import { m3sToLps } from '../../engine/units';
import type { LocalizedText } from '../../engine/types';
import type { ScenarioPipe, ScenarioPump, ScenarioReservoir } from '../../scenarios/types';
import type { LimitStatus } from './status';
import { networkStrings as text, velocityStatusLabels } from './strings';

/** Flows below this (m³/s) are drawn and described as no flow. */
export const NO_FLOW = 1e-7;

interface Tools {
  tr: (text: LocalizedText) => string;
  num: (value: number, digits?: number) => string;
}

/** Accessible name of a pipe: id, DN and, after a calculation, flow, velocity and status. */
export function describePipe(
  { tr, num }: Tools,
  pipe: ScenarioPipe,
  dn: number,
  result: PipeResult | undefined,
  status: LimitStatus,
  stale: boolean,
): string {
  const flow = result?.flow ?? 0;
  const reverse = flow < 0;
  return [
    tr(text.pipe(pipe.id)),
    `DN ${dn} mm`,
    pipe.fixed && tr(text.fixedDiameter),
    result && `${tr(text.flow)} ${num(m3sToLps(Math.abs(flow)))} L/s`,
    result && `${tr(text.velocity)} ${num(Math.abs(result.velocity))} m/s`,
    result &&
      (Math.abs(flow) > NO_FLOW
        ? tr(reverse ? text.flowFromTo(pipe.to, pipe.from) : text.flowFromTo(pipe.from, pipe.to))
        : tr(text.noFlow)),
    result && status !== 'none' && tr(velocityStatusLabels[status]),
    result && stale && tr(text.outdated),
  ]
    .filter(Boolean)
    .join(', ');
}

export function describePump(
  { tr, num }: Tools,
  pump: ScenarioPump,
  result: PumpResult | undefined,
  stale: boolean,
): string {
  return [
    tr(text.pump(pump.id)),
    result &&
      `${tr(text.flow)} ${num(m3sToLps(result.flow))} L/s, ${tr(text.head)} ${num(result.head)} m`,
    result && stale && tr(text.outdated),
  ]
    .filter(Boolean)
    .join(', ');
}

export function describeReservoir({ tr, num }: Tools, reservoir: ScenarioReservoir): string {
  return `${tr(text.reservoir(reservoir.id))}, ${tr(text.waterLevel)} ${num(reservoir.waterLevel)} m`;
}
