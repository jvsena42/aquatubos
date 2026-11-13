import type { Point } from './geometry';
import { PIPE_MARK_RADIUS } from './schematicLabels';

/**
 * Mark on a pipe outside the velocity limits, so the status is not shown by colour alone: a
 * disc with a triangle, down for too slow and up for too fast.
 */
export function PipeMark({ at, status }: { at: Point; status: 'low' | 'high' }) {
  const s = status === 'low' ? 1 : -1;
  return (
    <g
      className="netview__pipe-mark"
      data-mark={status}
      transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}
    >
      <circle r={PIPE_MARK_RADIUS} />
      <polygon points={`-3.6,${-2.4 * s} 3.6,${-2.4 * s} 0,${3.6 * s}`} />
    </g>
  );
}
