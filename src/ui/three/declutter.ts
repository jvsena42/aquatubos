/** Screen rectangle of a label, CSS px, with what decides who stays when two overlap. */
export interface LabelBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Higher stays. */
  priority: number;
  /** Normalised depth (−1 near, 1 far): between equal priorities the nearer stays. */
  depth: number;
  /** Width of the short form of the label, when it has one. It keeps the same centre. */
  shortWidth?: number;
}

export type LabelForm = 'full' | 'short';

type Rect = Pick<LabelBox, 'left' | 'top' | 'right' | 'bottom'>;

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  );
}

/**
 * Chooses which labels to show so that no two overlap. Labels are taken by priority (then
 * nearest first). Each one is shown in full when that leaves at least `gap` px to those already
 * placed, else in its short form when that fits, else not at all. Returns the form of every
 * label that is shown.
 */
export function placeLabels(boxes: readonly LabelBox[], gap = 2): Map<string, LabelForm> {
  const ordered = [...boxes].sort((a, b) => b.priority - a.priority || a.depth - b.depth);
  const placed: Rect[] = [];
  const forms = new Map<string, LabelForm>();
  for (const box of ordered) {
    const free = (rect: Rect) => placed.every((other) => !overlaps(rect, other, gap));
    if (free(box)) {
      placed.push(box);
      forms.set(box.id, 'full');
      continue;
    }
    if (box.shortWidth === undefined) continue;
    const centre = (box.left + box.right) / 2;
    const short = {
      left: centre - box.shortWidth / 2,
      right: centre + box.shortWidth / 2,
      top: box.top,
      bottom: box.bottom,
    };
    if (free(short)) {
      placed.push(short);
      forms.set(box.id, 'short');
    }
  }
  return forms;
}
