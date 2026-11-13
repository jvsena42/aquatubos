import {
  gridRects,
  nearestOnRect,
  placeLabels,
  ringRects,
  rectsOverlap,
  segmentRectDistance,
  textWidth,
  type LabelRequest,
  type Rect,
} from './labels';

const bounds: Rect = { x: 0, y: 0, width: 200, height: 100 };
const rect = (x: number, y: number, width = 40, height = 14): Rect => ({ x, y, width, height });

/** A label with one position per detail level, most detailed first. */
function label(id: string, priority: number, ...rects: Rect[]): LabelRequest<string> {
  return {
    id,
    priority,
    options: rects.map((r, index) => ({
      rect: r,
      detail: rects.length - 1 - index,
      data: `${id}:${rects.length - 1 - index}`,
    })),
  };
}

describe('label geometry', () => {
  it('tests rectangles for overlap, with an optional gap', () => {
    expect(rectsOverlap(rect(0, 0), rect(39, 13))).toBe(true);
    expect(rectsOverlap(rect(0, 0), rect(40, 0))).toBe(false);
    expect(rectsOverlap(rect(0, 0), rect(41, 0), 2)).toBe(true);
    expect(rectsOverlap(rect(0, 0), rect(0, 20), 2)).toBe(false);
  });

  it('measures the distance from a segment to a rectangle', () => {
    const box = rect(10, 10, 20, 10);
    // Horizontal line 4 px above the box.
    expect(segmentRectDistance({ x: 0, y: 6 }, { x: 50, y: 6 }, box)).toBeCloseTo(4);
    // Crossing it, ending inside it, and passing its corner at hypot(3, 4) = 5.
    expect(segmentRectDistance({ x: 0, y: 15 }, { x: 50, y: 15 }, box)).toBe(0);
    expect(segmentRectDistance({ x: 0, y: 0 }, { x: 15, y: 15 }, box)).toBe(0);
    expect(segmentRectDistance({ x: 33, y: 24 }, { x: 60, y: 60 }, box)).toBeCloseTo(5);
    expect(segmentRectDistance({ x: 5, y: 0 }, { x: 5, y: 0 }, box)).toBeCloseTo(Math.hypot(5, 10));
  });

  it('estimates wider text for more and bolder characters', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('T10')).toBeGreaterThan(textWidth('T1'));
    expect(textWidth('N1', 12, true)).toBeGreaterThan(textWidth('N1'));
    expect(textWidth('12,9 mca', 24)).toBeCloseTo(2 * textWidth('12,9 mca', 12));
    // A dozen characters of 12 px text stay well under 100 px.
    expect(textWidth('T2 · DN 75')).toBeLessThan(100);
    expect(textWidth('T2 · DN 75')).toBeGreaterThan(40);
  });
});

describe('placeLabels', () => {
  it('keeps the most detailed option of every label when nothing collides', () => {
    const placed = placeLabels(
      [
        label('a', 1, rect(10, 10, 80), rect(10, 10)),
        label('b', 1, rect(10, 60, 80), rect(10, 60)),
      ],
      { bounds },
    );
    expect(placed.get('a')?.data).toBe('a:1');
    expect(placed.get('b')?.data).toBe('b:1');
  });

  it('drops text from the lower priority label first', () => {
    // The long variants overlap each other; the short ones do not.
    const requests = [
      label('low', 1, rect(60, 10, 100), rect(120, 10, 30)),
      label('high', 5, rect(10, 10, 100), rect(10, 10, 30)),
    ];
    const placed = placeLabels(requests, { bounds });
    expect(placed.get('high')?.data).toBe('high:1');
    expect(placed.get('low')?.data).toBe('low:0');
  });

  it('gives every label its short text before any label grows', () => {
    // If "high" grew first, "low" would have no place at all.
    const requests = [
      label('high', 5, rect(10, 10, 150), rect(10, 10, 30)),
      label('low', 1, rect(100, 10, 30)),
    ];
    const placed = placeLabels(requests, { bounds });
    expect(placed.get('low')?.data).toBe('low:0');
    expect(placed.get('high')?.data).toBe('high:0');
  });

  it('moves a label to its next position when the first is taken', () => {
    const requests: LabelRequest<string>[] = [
      label('first', 2, rect(10, 10)),
      {
        id: 'second',
        priority: 1,
        options: [
          { rect: rect(20, 12), detail: 0, data: 'over' },
          { rect: rect(20, 40), detail: 0, data: 'below' },
        ],
      },
    ];
    expect(placeLabels(requests, { bounds }).get('second')?.data).toBe('below');
  });

  it('drops a label that has no free place, unless it is required', () => {
    const blocker = label('blocker', 9, rect(10, 10));
    const stuck = label('stuck', 1, rect(15, 12));
    expect(placeLabels([blocker, stuck], { bounds }).has('stuck')).toBe(false);
    const placed = placeLabels([blocker, { ...stuck, required: true }], { bounds });
    expect(placed.get('stuck')?.data).toBe('stuck:0');
  });

  it('keeps labels inside the bounds and off symbols and pipes', () => {
    const outside = label('outside', 1, rect(180, 10));
    const onSymbol = label('symbol', 1, rect(50, 50));
    const onPipe = label('pipe', 1, rect(100, 76));
    const free = label('free', 1, rect(100, 20));
    const placed = placeLabels([outside, onSymbol, onPipe, free], {
      bounds,
      rects: [rect(60, 55, 10, 10)],
      // Horizontal pipe at y = 72, 6 px wide: the label starts 4 px below its axis.
      segments: [{ a: { x: 0, y: 72 }, b: { x: 200, y: 72 }, half: 5 }],
    });
    expect([...placed.keys()]).toEqual(['free']);
    // A thinner pipe leaves the same label free.
    const thin = placeLabels([onPipe], {
      bounds,
      segments: [{ a: { x: 0, y: 72 }, b: { x: 200, y: 72 }, half: 3 }],
    });
    expect(thin.has('pipe')).toBe(true);
  });

  it('keeps a gap between labels', () => {
    const requests = [label('a', 2, rect(10, 10)), label('b', 1, rect(51, 10))];
    expect(placeLabels(requests, { bounds, gap: 2 }).has('b')).toBe(false);
    expect(placeLabels(requests, { bounds, gap: 0 }).has('b')).toBe(true);
  });

  it('prefers the position that covers fewer soft rects', () => {
    const request: LabelRequest<string> = {
      id: 'chip',
      priority: 1,
      options: [
        { rect: rect(10, 10), detail: 0, data: 'on two houses' },
        { rect: rect(10, 40), detail: 0, data: 'on one house' },
        { rect: rect(10, 70), detail: 0, data: 'clear' },
      ],
    };
    const soft = [rect(10, 10, 10, 10), rect(30, 10, 10, 10), rect(20, 45, 10, 10)];
    expect(placeLabels([request], { bounds, soft }).get('chip')?.data).toBe('clear');
    const withoutClear = { ...request, options: request.options.slice(0, 2) };
    expect(placeLabels([withoutClear], { bounds, soft }).get('chip')?.data).toBe('on one house');
  });

  it('uses an option with a soft limit only while it covers that few', () => {
    const request: LabelRequest<string> = {
      id: 'pipe',
      priority: 1,
      options: [
        { rect: rect(10, 10, 120), detail: 1, maxSoft: 0, data: 'long' },
        { rect: rect(10, 10, 30), detail: 0, data: 'short' },
      ],
    };
    const house = rect(100, 10, 10, 10);
    expect(placeLabels([request], { bounds, soft: [house] }).get('pipe')?.data).toBe('short');
    expect(placeLabels([request], { bounds }).get('pipe')?.data).toBe('long');
  });

  it('ignores requests without options', () => {
    expect(placeLabels([{ id: 'none', priority: 1, options: [] }], { bounds }).size).toBe(0);
  });
});

describe('labels that must be shown', () => {
  it('goes to a fallback place when every option is taken, and stays short there', () => {
    const taken = label('node', 5, rect(10, 10, 60));
    const pipe: LabelRequest<string> = {
      ...label('pipe', 1, rect(10, 10, 80), rect(20, 10, 30)),
      fallback: () => [
        { rect: rect(40, 12, 30), detail: 0, data: 'pipe:taken' },
        { rect: rect(100, 60, 30), detail: 0, data: 'pipe:far' },
      ],
    };
    const placed = placeLabels([taken, pipe], { bounds });
    expect(placed.get('node')?.data).toBe('node:0');
    expect(placed.get('pipe')?.data).toBe('pipe:far');
  });

  it('does not ask for the fallback places of a label that fits', () => {
    const fallback = vi.fn(() => []);
    placeLabels([{ ...label('a', 1, rect(10, 10)), fallback }], { bounds });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('lets a fallback place cover a pipe only when nothing else is left', () => {
    const segments = [{ a: { x: 0, y: 67 }, b: { x: 200, y: 67 }, half: 3 }];
    const request = (...far: Rect[]): LabelRequest<string> => ({
      ...label('pipe', 1, rect(-50, 0)),
      fallback: () => far.map((r, index) => ({ rect: r, detail: 0, data: `far:${index}` })),
    });
    // The first fallback place is on the pipe, the second is free: the second.
    expect(
      placeLabels([request(rect(10, 60), rect(10, 20))], { bounds, segments }).get('pipe')?.data,
    ).toBe('far:1');
    // Only the place on the pipe exists: better than no label.
    expect(placeLabels([request(rect(10, 60))], { bounds, segments }).get('pipe')?.data).toBe(
      'far:0',
    );
    // Never over a blocked rect or another label, and never outside the bounds.
    expect(
      placeLabels([request(rect(10, 60), rect(190, 20))], {
        bounds,
        segments,
        rects: [rect(0, 55, 30, 30)],
      }).has('pipe'),
    ).toBe(false);
  });

  it('moves a neighbour to another of its places before using a leader line', () => {
    // The node took the only place of the pipe, and has a second place of its own.
    const node: LabelRequest<string> = {
      id: 'node',
      priority: 5,
      options: [
        { rect: rect(10, 10), detail: 0, data: 'node:first' },
        { rect: rect(10, 60), detail: 0, data: 'node:second' },
      ],
    };
    const pipe: LabelRequest<string> = {
      ...label('pipe', 1, rect(20, 12)),
      fallback: () => [{ rect: rect(150, 80), detail: 0, data: 'pipe:far' }],
    };
    const placed = placeLabels([node, pipe], { bounds });
    expect(placed.get('pipe')?.data).toBe('pipe:0');
    expect(placed.get('node')?.data).toBe('node:second');
  });

  it('moves a less important label so that a more important one can show more text', () => {
    // The pipe id sits where the pressure of the node would go; the pipe has another side.
    const node = label('node', 5, rect(10, 10, 100), rect(10, 10, 20));
    const pipe: LabelRequest<string> = {
      id: 'pipe',
      priority: 1,
      options: [
        { rect: rect(60, 10, 20), detail: 0, data: 'pipe:above' },
        { rect: rect(60, 40, 20), detail: 0, data: 'pipe:below' },
      ],
    };
    const placed = placeLabels([node, pipe], { bounds });
    expect(placed.get('node')?.data).toBe('node:1');
    expect(placed.get('pipe')?.data).toBe('pipe:below');
    // The other way round nothing moves: a pipe does not push a node for its DN.
    const wide = label('pipe', 1, rect(10, 10, 100), rect(10, 10, 20));
    const fixed: LabelRequest<string> = { ...pipe, id: 'node', priority: 5 };
    const kept = placeLabels([fixed, wide], { bounds });
    expect(kept.get('node')?.data).toBe('pipe:above');
    expect(kept.get('pipe')?.data).toBe('pipe:0');
  });

  it('offers rings of places around a point, nearest first', () => {
    const size = { width: 20, height: 10 };
    const rects = ringRects({ x: 100, y: 50 }, size, [10, 30]);
    expect(rects).toHaveLength(16);
    // Below, above, right, left at 10 px of clearance.
    expect(rects[0]).toEqual({ x: 90, y: 60, ...size });
    expect(rects[1]).toEqual({ x: 90, y: 30, ...size });
    expect(rects[2]).toEqual({ x: 110, y: 45, ...size });
    expect(rects[3]).toEqual({ x: 70, y: 45, ...size });
    expect(rects[8]).toEqual({ x: 90, y: 80, ...size });
  });

  it('offers every place of a grid over the canvas, nearest first and within reach', () => {
    const size = { width: 20, height: 10 };
    const rects = gridRects({ x: 100, y: 50 }, size, bounds, 10, 60);
    const distance = (r: Rect) => Math.hypot(r.x + 10 - 100, r.y + 5 - 50);
    expect(rects.length).toBeGreaterThan(50);
    expect(distance(rects[0]!)).toBeLessThanOrEqual(5);
    for (const [index, r] of rects.entries()) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(200);
      expect(r.y + r.height).toBeLessThanOrEqual(100);
      expect(distance(r)).toBeLessThanOrEqual(60);
      if (index > 0) expect(distance(r)).toBeGreaterThanOrEqual(distance(rects[index - 1]!));
    }
  });

  it('finds where a leader line meets a label', () => {
    const box = rect(10, 10, 40, 20);
    expect(nearestOnRect({ x: 0, y: 0 }, box)).toEqual({ x: 10, y: 10 });
    expect(nearestOnRect({ x: 30, y: 100 }, box)).toEqual({ x: 30, y: 30 });
    expect(nearestOnRect({ x: 20, y: 15 }, box)).toEqual({ x: 20, y: 15 });
  });
});
