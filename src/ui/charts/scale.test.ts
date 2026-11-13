import {
  chartHeight,
  linearScale,
  nearestIndex,
  niceAxis,
  niceStep,
  polyline,
  thinTicks,
  tickLabelWidth,
  tickTarget,
} from './scale';

describe('linearScale', () => {
  it('maps the domain to the range, also when the range is inverted', () => {
    const x = linearScale([0, 10], [100, 200]);
    expect(x(0)).toBe(100);
    expect(x(5)).toBe(150);
    const y = linearScale([100, 150], [300, 0]);
    expect(y(100)).toBe(300);
    expect(y(150)).toBe(0);
  });

  it('returns the middle of the range for an empty domain', () => {
    expect(linearScale([5, 5], [0, 10])(5)).toBe(5);
  });
});

describe('niceStep', () => {
  it('picks 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(720, 6)).toBe(200);
    expect(niceStep(0.9, 5)).toBeCloseTo(0.2, 12);
    expect(niceStep(30, 6)).toBe(5);
  });
});

describe('niceAxis', () => {
  it('covers the interval with round ticks', () => {
    const axis = niceAxis(108, 151);
    expect(axis.ticks[0]).toBeLessThanOrEqual(108);
    expect(axis.ticks[axis.ticks.length - 1]).toBeGreaterThanOrEqual(151);
    expect(axis.ticks).toEqual([100, 110, 120, 130, 140, 150, 160]);
    expect(axis.digits).toBe(0);
  });

  it('keeps exact bounds that already are ticks', () => {
    expect(niceAxis(0, 30).ticks).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it('reports the decimals of fractional steps', () => {
    const axis = niceAxis(0, 0.9, 5);
    expect(axis.ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(axis.digits).toBe(1);
  });

  it('handles empty, inverted and non-finite intervals', () => {
    expect(niceAxis(5, 5).ticks.length).toBeGreaterThan(1);
    expect(niceAxis(10, 0).min).toBe(0);
    expect(niceAxis(Number.NaN, 1).ticks.length).toBeGreaterThan(1);
  });
});

describe('polyline', () => {
  it('joins points with one decimal', () => {
    expect(
      polyline([
        [0, 1.26],
        [10.04, 2],
      ]),
    ).toBe('0.0,1.3 10.0,2.0');
  });
});

describe('tickTarget', () => {
  it('asks for fewer intervals on a narrow axis', () => {
    // 250 px of plot on a 360 px phone against 716 px on a phone in landscape.
    expect(tickTarget(250, 47.5, 7)).toBe(5);
    expect(tickTarget(716, 47.5, 7)).toBe(7);
    expect(tickTarget(250, 47.5, 7)).toBeLessThan(tickTarget(716, 47.5, 7));
  });

  it('never goes below two intervals or above the maximum', () => {
    expect(tickTarget(40, 47.5, 7)).toBe(2);
    expect(tickTarget(5000, 47.5, 7)).toBe(7);
    expect(tickTarget(0, 47.5, 7)).toBe(2);
    expect(tickTarget(300, 0, 7)).toBe(2);
  });

  it('gives a narrow chart an axis with fewer ticks than a wide one', () => {
    const spacing = tickLabelWidth('30,0'.length) + 14;
    const narrow = niceAxis(0, 30, tickTarget(150, spacing, 8));
    const wide = niceAxis(0, 30, tickTarget(716, spacing, 8));
    expect(narrow.ticks).toEqual([0, 10, 20, 30]);
    expect(wide.ticks).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });
});

describe('thinTicks', () => {
  const ticks = [0, 5, 10, 15, 20, 25, 30];

  it('keeps every tick when they are far enough apart', () => {
    expect(thinTicks(ticks, linearScale([0, 30], [0, 600]), 40)).toEqual(ticks);
  });

  it('keeps every other tick, or fewer, until the labels fit', () => {
    // 30 px between ticks: labels 40 px wide need every second tick, 100 px every fourth.
    const x = linearScale([0, 30], [0, 180]);
    expect(thinTicks(ticks, x, 40)).toEqual([0, 10, 20, 30]);
    expect(thinTicks(ticks, x, 100)).toEqual([0, 20]);
    expect(thinTicks(ticks, x, 1000)).toEqual([0]);
  });

  it('measures the gap on inverted (vertical) scales too', () => {
    expect(thinTicks([0, 20, 40, 60], linearScale([0, 60], [170, 0]), 80)).toEqual([0, 40]);
  });

  it('never leaves neighbours closer than the gap', () => {
    for (const width of [120, 250, 310, 500, 716]) {
      const x = linearScale([0, 30], [0, width]);
      const kept = thinTicks(ticks, x, 47.5);
      for (let i = 1; i < kept.length; i++) {
        expect(x(kept[i]!) - x(kept[i - 1]!)).toBeGreaterThanOrEqual(47.5);
      }
    }
  });
});

describe('chartHeight', () => {
  it('keeps 400 px on a desktop', () => {
    expect(chartHeight(900, 860)).toBe(400);
    expect(chartHeight(720, Number.POSITIVE_INFINITY)).toBe(400);
  });

  it('follows the width on a phone in portrait', () => {
    expect(chartHeight(310, 740)).toBe(242);
    expect(chartHeight(398, 932)).toBe(310);
    expect(chartHeight(500, 932)).toBe(320);
  });

  it('fits the viewport of a phone in landscape', () => {
    const height = chartHeight(786, 390);
    expect(height).toBe(240);
    expect(height).toBeLessThan(390);
  });

  it('never goes below 220 px', () => {
    expect(chartHeight(280, 300)).toBe(220);
    expect(chartHeight(200, 740)).toBe(220);
  });
});

describe('nearestIndex', () => {
  it('finds the closest value', () => {
    expect(nearestIndex([10, 50, 90], 0)).toBe(0);
    expect(nearestIndex([10, 50, 90], 60)).toBe(1);
    expect(nearestIndex([10, 50, 90], 500)).toBe(2);
  });

  it('returns -1 for an empty list', () => {
    expect(nearestIndex([], 3)).toBe(-1);
  });
});
