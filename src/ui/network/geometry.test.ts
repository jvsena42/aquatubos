import {
  fitToSize,
  INITIAL_VIEW,
  labelSide,
  MAX_ZOOM,
  MIN_ZOOM,
  pipeLabelAnchor,
  strokeForDn,
  toScreen,
  zoomAt,
} from './geometry';

const size = { width: 400, height: 300 };

describe('network geometry', () => {
  it('fits the points inside the padding and centres them', () => {
    const points = [
      { x: 0, y: 200 },
      { x: 1000, y: 200 },
      { x: 500, y: 0 },
    ];
    const fit = fitToSize(points, size, { x: 50, y: 30 });
    expect(fit.scale).toBeCloseTo(0.3, 9);
    expect(toScreen(points[0]!, fit, INITIAL_VIEW, size)).toEqual({ x: 50, y: 180 });
    expect(toScreen(points[1]!, fit, INITIAL_VIEW, size).x).toBeCloseTo(350, 9);
  });

  it('fits a network that lies on one line', () => {
    const fit = fitToSize(
      [
        { x: 0, y: 5 },
        { x: 100, y: 5 },
      ],
      size,
      { x: 50, y: 30 },
    );
    expect(fit.scale).toBeCloseTo(3, 9);
    expect(fitToSize([{ x: 3, y: 4 }], size, { x: 0, y: 0 }).scale).toBe(1);
  });

  it('zooms around the anchor and respects the limits', () => {
    const anchor = { x: 300, y: 100 };
    const fit = { scale: 1, center: { x: 0, y: 0 } };
    const world = { x: 100, y: -50 };
    expect(toScreen(world, fit, INITIAL_VIEW, size)).toEqual(anchor);
    const zoomed = zoomAt(INITIAL_VIEW, 2, anchor, size);
    expect(zoomed.k).toBe(2);
    expect(toScreen(world, fit, zoomed, size)).toEqual(anchor);
    expect(zoomAt(INITIAL_VIEW, 1000, anchor, size).k).toBe(MAX_ZOOM);
    expect(zoomAt(INITIAL_VIEW, 0.001, anchor, size).k).toBe(MIN_ZOOM);
  });

  it('puts node labels away from the pipes', () => {
    const node = { x: 0, y: 0 };
    expect(labelSide(node, [])).toBe('s');
    expect(labelSide(node, [{ x: 10, y: 0 }])).toBe('s');
    expect(labelSide(node, [{ x: 0, y: 10 }])).toBe('n');
    expect(
      labelSide(node, [
        { x: 0, y: 10 },
        { x: 0, y: -10 },
      ]),
    ).toBe('e');
    expect(
      labelSide(node, [
        { x: 0, y: 10 },
        { x: 0, y: -10 },
        { x: 10, y: 0 },
      ]),
    ).toBe('w');
  });

  it('puts pipe labels above horizontal pipes and on the inner side of vertical ones', () => {
    const inward = { x: 100, y: 100 };
    const above = pipeLabelAnchor({ x: 0, y: 50 }, { x: 100, y: 50 }, 10, inward);
    expect(above).toMatchObject({ x: 50, y: 40, anchor: 'middle', block: 'above' });
    expect(pipeLabelAnchor({ x: 100, y: 50 }, { x: 0, y: 50 }, 10, inward)).toMatchObject(above);
    expect(pipeLabelAnchor({ x: 20, y: 0 }, { x: 20, y: 100 }, 10, inward)).toMatchObject({
      x: 30,
      anchor: 'start',
      block: 'centered',
    });
    expect(pipeLabelAnchor({ x: 180, y: 0 }, { x: 180, y: 100 }, 10, inward)).toMatchObject({
      x: 170,
      anchor: 'end',
    });
  });

  it('scales the stroke with the DN', () => {
    expect(strokeForDn(50)).toBe(4);
    expect(strokeForDn(300)).toBe(11);
    expect(strokeForDn(150)).toBeGreaterThan(strokeForDn(100));
  });
});
