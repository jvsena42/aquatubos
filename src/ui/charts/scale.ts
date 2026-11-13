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

/**
 * Number of tick intervals that fit an axis `length` px long when each label needs `spacing`
 * px, between 2 and `max`. Narrow charts get fewer ticks so the labels never touch.
 */
export function tickTarget(length: number, spacing: number, max: number): number {
  if (!(length > 0) || !(spacing > 0)) return 2;
  return Math.max(2, Math.min(max, Math.floor(length / spacing)));
}

/**
 * Drops ticks until neighbours are at least `minGap` px apart: keeps every k-th tick, starting
 * from the first, with the smallest k that fits. `position` maps a tick to its pixel.
 */
export function thinTicks(
  ticks: readonly number[],
  position: (tick: number) => number,
  minGap: number,
): number[] {
  for (let every = 1; every < ticks.length; every++) {
    const kept = ticks.filter((_, index) => index % every === 0);
    const fits = kept.every(
      (tick, index) =>
        index === 0 || Math.abs(position(tick) - position(kept[index - 1]!)) >= minGap,
    );
    if (fits) return kept;
  }
  return ticks.slice(0, 1);
}

/** Approximate width in px of a tick label of `characters` monospace characters at 11 px. */
export function tickLabelWidth(characters: number): number {
  return characters * 6.7;
}

/**
 * Height in px of a chart drawn `width` px wide in a viewport `viewportHeight` px tall. Wide
 * charts keep 400 px. Narrow ones follow the width, and the chart always leaves room in the
 * viewport, so a phone in landscape shows the whole of it.
 */
export function chartHeight(width: number, viewportHeight: number): number {
  const most = width < 520 ? 320 : 400;
  const room = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight - 150 : most;
  return Math.round(Math.max(220, Math.min(most, width * 0.78, room)));
}

/** Index of the value closest to `target`, or -1 for an empty list. */
export function nearestIndex(values: readonly number[], target: number): number {
  let best = -1;
  let distance = Infinity;
  values.forEach((value, index) => {
    const d = Math.abs(value - target);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return best;
}
