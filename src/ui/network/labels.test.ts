import {
  placeLabels,
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
