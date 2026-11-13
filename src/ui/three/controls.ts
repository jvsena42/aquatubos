import { MOUSE, TOUCH } from 'three';

/**
 * Gestures of the orbit controls. One finger (or the left button) orbits; two fingers zoom by
 * pinching and pan by dragging together; the wheel zooms and the right button pans.
 */
export const ORBIT_GESTURES = {
  touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN },
  mouseButtons: { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN },
} as const;

/**
 * Whether a zoom started by this kind of pointer moves towards the pointer. The wheel does.
 * A pinch zooms towards the centre of the view instead: the controls locate the pinch with page
 * coordinates, which sends the camera to the wrong place (even under the terrain) whenever the
 * page is scrolled. A two-finger drag pans, so any point can still be brought to the centre.
 */
export function zoomsToCursor(pointerType: string): boolean {
  return pointerType !== 'touch';
}
