import { placeLabels, type LabelBox } from './declutter';

/** A 40 × 16 label whose bottom centre is at (x, y). */
function box(id: string, x: number, y: number, extra: Partial<LabelBox> = {}): LabelBox {
  return {
    id,
    left: x - 20,
    right: x + 20,
    top: y - 16,
    bottom: y,
    priority: 1,
    depth: 0,
    ...extra,
  };
}

describe('placeLabels', () => {
  it('shows every label in full when none overlap', () => {
    const forms = placeLabels([box('a', 50, 50), box('b', 150, 50), box('c', 50, 100)]);
    expect([...forms]).toEqual([
      ['a', 'full'],
      ['b', 'full'],
      ['c', 'full'],
    ]);
  });

  it('hides the label of lower priority when two overlap', () => {
    const forms = placeLabels([box('low', 50, 50), box('high', 60, 55, { priority: 2 })]);
    expect(forms.get('high')).toBe('full');
    expect(forms.has('low')).toBe(false);
  });

  it('keeps the nearer label between equal priorities', () => {
    const forms = placeLabels([
      box('far', 50, 50, { depth: 0.9 }),
      box('near', 60, 55, { depth: 0.2 }),
    ]);
    expect([...forms.keys()]).toEqual(['near']);
  });

  it('falls back to the short form when only that fits', () => {
    // 'b' spans 55..95 and overlaps 'a' (30..70). Its 12 px short form spans 69..81: 69 is
    // closer than the 2 px gap to 70, so it needs to be narrower still.
    const a = box('a', 50, 50, { priority: 2 });
    expect(placeLabels([a, box('b', 75, 50, { shortWidth: 12 })]).has('b')).toBe(false);
    // 6 px: 72..78, which clears 70 by the gap.
    expect(placeLabels([a, box('b', 75, 50, { shortWidth: 6 })]).get('b')).toBe('short');
  });

  it('lets a later label use the room that a short form freed', () => {
    const forms = placeLabels([
      box('a', 50, 50, { priority: 3 }),
      box('b', 85, 50, { priority: 2, shortWidth: 10 }),
      box('c', 115, 50, { priority: 1 }),
    ]);
    // 'b' in full (65..105) would touch 'a' (30..70); short it is 80..90, and 'c' (95..135) fits.
    expect([...forms]).toEqual([
      ['a', 'full'],
      ['b', 'short'],
      ['c', 'full'],
    ]);
  });

  it('never returns two labels that overlap', () => {
    // A 6 × 6 lattice of 40 px labels 25 px apart: neighbours overlap in x.
    const boxes: LabelBox[] = [];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        boxes.push(
          box(`${i}-${j}`, i * 25, j * 12, { priority: (i * 7 + j * 3) % 4, depth: i / 10 }),
        );
      }
    }
    const forms = placeLabels(boxes);
    const shown = boxes.filter((b) => forms.has(b.id));
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.length).toBeLessThan(boxes.length);
    for (const a of shown) {
      for (const b of shown) {
        if (a === b) continue;
        const apart =
          a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
        expect(apart).toBe(true);
      }
    }
  });

  it('returns nothing for no labels', () => {
    expect(placeLabels([]).size).toBe(0);
  });
});
