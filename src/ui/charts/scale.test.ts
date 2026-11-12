import { linearScale, niceAxis, niceStep, polyline } from './scale';

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
