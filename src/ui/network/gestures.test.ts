import { INITIAL_VIEW, toScreen, type Fit, type Point, type Size, type View } from './geometry';
import {
  DOUBLE_TAP_DISTANCE,
  DOUBLE_TAP_MS,
  exceedsSlop,
  isDoubleTap,
  panView,
  pinchView,
  TAP_SLOP,
  tapSlop,
} from './gestures';

const SIZE: Size = { width: 360, height: 400 };
const FIT: Fit = { scale: 0.3, center: { x: 500, y: 400 } };

/** World point drawn at a screen point: the inverse of `toScreen`. */
function toWorld(screen: Point, view: View): Point {
  const scale = FIT.scale * view.k;
  return {
    x: FIT.center.x + (screen.x - SIZE.width / 2 - view.x) / scale,
    y: FIT.center.y + (screen.y - SIZE.height / 2 - view.y) / scale,
  };
}

describe('tap or drag', () => {
  it('gives a finger twice the slop of a mouse', () => {
    expect(tapSlop('mouse')).toBe(TAP_SLOP.mouse);
    expect(tapSlop('touch')).toBe(8);
    expect(tapSlop('pen')).toBe(8);
  });

  it('keeps a press a tap while it moves less than the slop', () => {
    const start = { x: 100, y: 100 };
    // 5 px right and 5 px down is 7.07 px of travel.
    expect(exceedsSlop(start, { x: 105, y: 105 }, tapSlop('touch'))).toBe(false);
    expect(exceedsSlop(start, { x: 108, y: 100 }, tapSlop('touch'))).toBe(true);
    expect(exceedsSlop(start, { x: 103, y: 103 }, tapSlop('mouse'))).toBe(true);
  });
});

describe('panView', () => {
  it('moves the view by the travel of the pointer and keeps the zoom', () => {
    expect(panView({ k: 2, x: 10, y: -5 }, { x: 100, y: 100 }, { x: 130, y: 90 })).toEqual({
      k: 2,
      x: 40,
      y: -15,
    });
  });
});

describe('pinchView', () => {
  it('zooms by the change of the distance between the fingers', () => {
    // Fingers 100 px apart; one moves 50 px away: 150 / 100 = 1.5.
    const view = pinchView(
      INITIAL_VIEW,
      { x: 230, y: 200 },
      { x: 280, y: 200 },
      { x: 130, y: 200 },
      SIZE,
    );
    expect(view.k).toBeCloseTo(1.5, 9);
  });

  it('keeps the point of the drawing under the midpoint of the fingers', () => {
    const other = { x: 100, y: 150 };
    const previous = { x: 220, y: 250 };
    const point = { x: 260, y: 300 };
    const start: View = { k: 1.3, x: 24, y: -12 };
    const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
    const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
    const anchored = toWorld(midBefore, start);

    const view = pinchView(start, previous, point, other, SIZE);

    const drawn = toScreen(anchored, FIT, view, SIZE);
    expect(drawn.x).toBeCloseTo(midAfter.x, 6);
    expect(drawn.y).toBeCloseTo(midAfter.y, 6);
    expect(view.k).toBeGreaterThan(start.k);
  });

  it('pans without zooming when both fingers keep their distance', () => {
    // The moving finger and the midpoint: the other finger gets its own step afterwards.
    const view = pinchView(
      INITIAL_VIEW,
      { x: 200, y: 100 },
      { x: 200, y: 140 },
      { x: 100, y: 120 },
      SIZE,
    );
    expect(view.y).toBeGreaterThan(0);
    expect(view.k).toBeCloseTo(Math.hypot(100, 20) / Math.hypot(100, 20), 9);
  });

  it('ignores a step when the fingers are on the same point', () => {
    const view: View = { k: 2, x: 5, y: 5 };
    expect(pinchView(view, { x: 50, y: 50 }, { x: 60, y: 50 }, { x: 50, y: 50 }, SIZE)).toBe(view);
  });

  it('stops at the zoom limits', () => {
    const view = pinchView(
      INITIAL_VIEW,
      { x: 181, y: 200 },
      { x: 359, y: 200 },
      { x: 180, y: 200 },
      SIZE,
    );
    expect(view.k).toBe(8);
  });
});

describe('isDoubleTap', () => {
  const first = { point: { x: 100, y: 100 }, time: 1000 };

  it('needs a first tap', () => {
    expect(isDoubleTap(null, first)).toBe(false);
  });

  it('accepts a second tap that is close in time and place', () => {
    expect(isDoubleTap(first, { point: { x: 110, y: 104 }, time: 1200 })).toBe(true);
  });

  it('rejects a late or distant second tap', () => {
    expect(isDoubleTap(first, { point: { x: 100, y: 100 }, time: 1000 + DOUBLE_TAP_MS + 1 })).toBe(
      false,
    );
    expect(
      isDoubleTap(first, { point: { x: 100 + DOUBLE_TAP_DISTANCE + 1, y: 100 }, time: 1100 }),
    ).toBe(false);
  });
});
