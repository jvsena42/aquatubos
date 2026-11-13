import { placeTooltip, tooltipWidth, type Box } from './tooltipPosition';

const PHONE = { width: 360, height: 640 };

/** A 60 × 20 term whose top left corner is at (left, top). */
function term(left: number, top: number, width = 60): Box {
  return { left, top, right: left + width, bottom: top + 20 };
}

describe('tooltipWidth', () => {
  it('is 320 px where there is room and the viewport minus the margins on a narrow one', () => {
    expect(tooltipWidth(1366)).toBe(320);
    expect(tooltipWidth(360)).toBe(320);
    expect(tooltipWidth(320)).toBe(304);
    expect(tooltipWidth(10)).toBe(0);
  });
});

describe('placeTooltip', () => {
  it('goes below the term, aligned with its left edge, when there is room', () => {
    expect(placeTooltip({ anchor: term(20, 100), height: 120, viewport: PHONE })).toEqual({
      left: 20,
      top: 124,
      width: 320,
      maxHeight: null,
      side: 'below',
    });
  });

  it('shifts left for a term near the right edge of a 360 px screen', () => {
    // The term spans 290..350. A 320 px tooltip must end at 352 (8 px margin): left = 32.
    const placed = placeTooltip({ anchor: term(290, 100), height: 120, viewport: PHONE });
    expect(placed.left).toBe(32);
    expect(placed.left + placed.width).toBe(352);
    expect(placed.side).toBe('below');
  });

  it('never leaves the left margin, even for a term scrolled partly out on the left', () => {
    expect(placeTooltip({ anchor: term(-30, 100), height: 120, viewport: PHONE }).left).toBe(8);
    expect(placeTooltip({ anchor: term(2, 100), height: 120, viewport: PHONE }).left).toBe(8);
  });

  it('uses the whole width between the margins on a screen narrower than the tooltip', () => {
    const placed = placeTooltip({
      anchor: term(200, 100),
      height: 120,
      viewport: { width: 300, height: 640 },
    });
    expect(placed).toMatchObject({ left: 8, width: 284 });
  });

  it('flips above a term near the bottom', () => {
    // Below there are 640 − 8 − 604 = 28 px; above 580 − 4 − 8 = 568 px.
    const placed = placeTooltip({ anchor: term(20, 580), height: 120, viewport: PHONE });
    expect(placed).toMatchObject({ side: 'above', top: 456, maxHeight: null });
    expect(placed.top + 120).toBe(576);
  });

  it('stays below when it fits exactly and flips one pixel later', () => {
    // Bottom of the term at 508: room below is 640 − 8 − 512 = 120.
    expect(placeTooltip({ anchor: term(20, 488), height: 120, viewport: PHONE }).side).toBe(
      'below',
    );
    expect(placeTooltip({ anchor: term(20, 489), height: 120, viewport: PHONE }).side).toBe(
      'above',
    );
  });

  it('takes the side with more room and limits the height when neither fits', () => {
    const landscape = { width: 844, height: 390 };
    // Term at 150..170: 138 px above, 208 px below. A 300 px tooltip scrolls in 208 px below.
    expect(placeTooltip({ anchor: term(20, 150), height: 300, viewport: landscape })).toMatchObject(
      { side: 'below', top: 174, maxHeight: 208 },
    );
    // Term at 250..270: 238 px above, 108 px below.
    expect(placeTooltip({ anchor: term(20, 250), height: 300, viewport: landscape })).toMatchObject(
      { side: 'above', top: 8, maxHeight: 238 },
    );
  });

  it('keeps the whole tooltip inside the viewport wherever the term is', () => {
    const viewports = [
      PHONE,
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1366, height: 860 },
    ];
    for (const viewport of viewports) {
      for (const height of [60, 140, 300, 900]) {
        for (let x = -40; x <= viewport.width; x += 37) {
          for (let y = 0; y <= viewport.height - 20; y += 41) {
            const placed = placeTooltip({ anchor: term(x, y), height, viewport });
            const shown = Math.min(height, placed.maxHeight ?? Infinity);
            expect(placed.left).toBeGreaterThanOrEqual(8);
            expect(placed.left + placed.width).toBeLessThanOrEqual(viewport.width - 8);
            expect(placed.top).toBeGreaterThanOrEqual(8);
            expect(placed.top + shown).toBeLessThanOrEqual(viewport.height - 8);
            // It never covers the term.
            expect(placed.top >= y + 20 || placed.top + shown <= y).toBe(true);
          }
        }
      }
    }
  });

  it('honours other margins, gaps and widths', () => {
    const placed = placeTooltip({
      anchor: term(300, 100),
      height: 50,
      viewport: PHONE,
      maxWidth: 200,
      margin: 16,
      gap: 10,
    });
    expect(placed).toEqual({ left: 144, top: 130, width: 200, maxHeight: null, side: 'below' });
  });
});
