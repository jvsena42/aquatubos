/** Linear map from a data interval to a pixel interval. */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Step of the form 1, 2 or 5 × 10^k that gives about `target` intervals over `span`. */
export function niceStep(span: number, target: number): number {
  if (!(span > 0) || !(target > 0)) return 1;
  const raw = span / target;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export interface Axis {
  /** Domain widened to whole steps. */
  min: number;
  max: number;
  step: number;
  ticks: number[];
  /** Decimals needed to write the ticks. */
  digits: number;
}

/** Axis with round tick values that covers [min, max]. */
export function niceAxis(min: number, max: number, target = 6): Axis {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return niceAxis(0, 1, target);
  if (max < min) return niceAxis(max, min, target);
  if (max === min) return niceAxis(min - 1, max + 1, target);
  const step = niceStep(max - min, target);
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const round = (value: number) => Number(value.toFixed(digits));
  const low = round(Math.floor(min / step + 1e-9) * step);
  const high = round(Math.ceil(max / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = 0; low + i * step <= high + step * 1e-6; i++) ticks.push(round(low + i * step));
  return { min: low, max: high, step, ticks, digits };
}

/** "x,y x,y …" for an SVG polyline. */
export function polyline(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
