/** A rectangle in viewport coordinates, CSS px (as getBoundingClientRect returns). */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TooltipPlacement {
  left: number;
  top: number;
  width: number;
  /** Set when the tooltip is taller than the room on its side: it then scrolls inside. */
  maxHeight: number | null;
  side: 'below' | 'above';
}

export interface TooltipInput {
  /** The term the tooltip belongs to. */
  anchor: Box;
  /** Height of the tooltip at the width given by `tooltipWidth`. */
  height: number;
  viewport: { width: number; height: number };
  /** Widest the tooltip gets. */
  maxWidth?: number;
  /** Distance kept from the edges of the viewport. */
  margin?: number;
  /** Distance between the term and the tooltip. */
  gap?: number;
}

/** Width of the tooltip: `maxWidth`, or what the viewport leaves between the margins. */
export function tooltipWidth(viewportWidth: number, maxWidth = 320, margin = 8): number {
  return Math.max(0, Math.min(maxWidth, viewportWidth - 2 * margin));
}

/**
 * Where to put a tooltip (position: fixed) so that all of it is inside the viewport.
 *
 * Horizontally it starts at the left edge of the term and is shifted left as far as needed to
 * keep the margin on the right, but never past the margin on the left. Vertically it goes below
 * the term when it fits there, else above when it fits there, else on the side with more room,
 * limited to that room.
 */
export function placeTooltip({
  anchor,
  height,
  viewport,
  maxWidth = 320,
  margin = 8,
  gap = 4,
}: TooltipInput): TooltipPlacement {
  const width = tooltipWidth(viewport.width, maxWidth, margin);
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - margin - width));

  const roomBelow = viewport.height - margin - (anchor.bottom + gap);
  const roomAbove = anchor.top - gap - margin;
  const side = height <= roomBelow || roomBelow >= roomAbove ? 'below' : 'above';
  const room = Math.max(0, side === 'below' ? roomBelow : roomAbove);
  const shown = Math.min(height, room);
  const top = side === 'below' ? anchor.bottom + gap : anchor.top - gap - shown;
  return { left, top, width, maxHeight: height > room ? room : null, side };
}
