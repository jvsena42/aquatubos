/** Whether there is content hidden before the start and after the end of a scroller. */
export interface ScrollEdges {
  start: boolean;
  end: boolean;
}

/**
 * Hidden content on each side of a horizontal scroller, from its scroll metrics. A pixel of
 * tolerance absorbs the fractional positions of high-density screens.
 */
export function scrollEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  tolerance = 1,
): ScrollEdges {
  const hidden = scrollWidth - clientWidth;
  if (!(hidden > tolerance)) return { start: false, end: false };
  const offset = Math.abs(scrollLeft);
  return { start: offset > tolerance, end: offset < hidden - tolerance };
}
