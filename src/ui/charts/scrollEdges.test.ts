import { scrollEdges } from './scrollEdges';

describe('scrollEdges', () => {
  it('reports nothing hidden when the content fits', () => {
    expect(scrollEdges(0, 320, 320)).toEqual({ start: false, end: false });
    expect(scrollEdges(0, 320, 320.6)).toEqual({ start: false, end: false });
  });

  it('reports hidden content after the end at the start of the scroll', () => {
    expect(scrollEdges(0, 308, 983)).toEqual({ start: false, end: true });
  });

  it('reports both sides in the middle', () => {
    expect(scrollEdges(200, 308, 983)).toEqual({ start: true, end: true });
  });

  it('drops the end at the end of the scroll, with a pixel of tolerance', () => {
    expect(scrollEdges(675, 308, 983)).toEqual({ start: true, end: false });
    expect(scrollEdges(674.4, 308, 983)).toEqual({ start: true, end: false });
  });

  it('accepts the negative offsets of right-to-left scrollers', () => {
    expect(scrollEdges(-200, 308, 983)).toEqual({ start: true, end: true });
  });
});
