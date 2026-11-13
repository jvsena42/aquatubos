/**
 * Resting heights of the bottom sheet: the bar only, a part of the viewport (`SHEET_HALF`), up
 * to the header.
 */
export type Detent = 'peek' | 'half' | 'full';

/**
 * Height of the `half` detent as a fraction of the viewport height, per device. It is the one
 * source: StageScreen writes it to the `--sheet-half-fraction` CSS variable (the sheet height
 * and the space the view keeps above it follow from that) and the drag code reads it here.
 * Phones stay under 40 % so the map keeps at least 40 % of the screen above the open sheet.
 */
export const SHEET_HALF = { phone: 0.36, tablet: 0.36 } as const;

export type SheetSection = 'calc' | 'checks';

export interface SheetState {
  detent: Detent;
  section: SheetSection;
}

export type SheetAction =
  /** The handle button: peek → half → full → peek. */
  | { type: 'cycle'; hasSelection: boolean }
  /** End of a drag, already resolved to a detent. */
  | { type: 'snap'; detent: Detent; hasSelection: boolean }
  /** Close button or Escape. */
  | { type: 'collapse' }
  | { type: 'section'; section: SheetSection }
  /** The player picked an element of the network. */
  | { type: 'selected' }
  /** A "Calcular / Verificar" finished. */
  | { type: 'verified'; passed: boolean };

export const initialSheetState: SheetState = { detent: 'peek', section: 'checks' };

const NEXT: Record<Detent, Detent> = { peek: 'half', half: 'full', full: 'peek' };

export function nextDetent(detent: Detent): Detent {
  return NEXT[detent];
}

/**
 * Opening from the bar shows what the bar announced: the calculation of the selected element,
 * or the checks when nothing is selected.
 */
function moveTo(state: SheetState, detent: Detent, hasSelection: boolean): SheetState {
  if (state.detent === 'peek' && detent !== 'peek') {
    return { detent, section: hasSelection ? 'calc' : 'checks' };
  }
  return state.detent === detent ? state : { ...state, detent };
}

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case 'cycle':
      return moveTo(state, NEXT[state.detent], action.hasSelection);
    case 'snap':
      return moveTo(state, action.detent, action.hasSelection);
    case 'collapse':
      return state.detent === 'peek' ? state : { ...state, detent: 'peek' };
    case 'section':
      return state.section === action.section ? state : { ...state, section: action.section };
    case 'selected':
      // The calculation of the picked element comes up, without shrinking an open sheet.
      return { detent: state.detent === 'peek' ? 'half' : state.detent, section: 'calc' };
    case 'verified':
      // Success leaves the map free for its animation; a failure brings the list of issues.
      return action.passed
        ? { ...state, detent: 'peek' }
        : { detent: state.detent === 'peek' ? 'half' : state.detent, section: 'checks' };
  }
}

/** Release speed (px/ms) above which a drag is a flick: it goes to the next detent that way. */
export const FLICK_VELOCITY = 0.4;

const ORDER: readonly Detent[] = ['peek', 'half', 'full'];

/**
 * Detent a released drag settles on. `height` is the sheet height at release, `velocity` its
 * rate of change in px/ms (positive while growing), `heights` the height of each detent. A
 * flick goes to the next detent in its direction; a slow release goes to the nearest one.
 */
export function snapDetent(
  height: number,
  velocity: number,
  heights: Record<Detent, number>,
): Detent {
  if (velocity >= FLICK_VELOCITY) {
    return ORDER.find((detent) => heights[detent] > height + 1) ?? 'full';
  }
  if (velocity <= -FLICK_VELOCITY) {
    return [...ORDER].reverse().find((detent) => heights[detent] < height - 1) ?? 'peek';
  }
  let nearest: Detent = 'peek';
  for (const detent of ORDER) {
    if (Math.abs(heights[detent] - height) < Math.abs(heights[nearest] - height)) nearest = detent;
  }
  return nearest;
}

/** Speed in px/ms over the last samples of a drag; positive when `y` decreases (finger going up). */
export function releaseVelocity(samples: readonly { time: number; y: number }[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  // Only the last 100 ms count, so a pause before lifting the finger is not a flick.
  const first = samples.find((sample) => last.time - sample.time <= 100) ?? last;
  const elapsed = last.time - first.time;
  return elapsed > 0 ? (first.y - last.y) / elapsed : 0;
}
