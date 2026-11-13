import { MOUSE, TOUCH } from 'three';
import { ORBIT_GESTURES, zoomsToCursor } from './controls';

describe('orbit gestures', () => {
  it('orbits with one finger and zooms and pans with two', () => {
    expect(ORBIT_GESTURES.touches).toEqual({ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN });
  });

  it('keeps the mouse buttons: left orbits, middle zooms, right pans', () => {
    expect(ORBIT_GESTURES.mouseButtons).toEqual({
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    });
  });

  it('zooms towards the pointer with a mouse or pen but not with a pinch', () => {
    expect(zoomsToCursor('mouse')).toBe(true);
    expect(zoomsToCursor('pen')).toBe(true);
    expect(zoomsToCursor('touch')).toBe(false);
  });
});
