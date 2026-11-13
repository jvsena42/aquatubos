import type { CSSProperties } from 'react';
import type { ServiceStatus } from '../../game/houses';
import type { Town } from '../../game/town';
import type { StageEvaluation } from '../../game/types';
import type { Diameters, Scenario } from '../../scenarios/types';
import type { Selection } from '../../state/store';
import { useNum } from '../network/format';
import type { Point, Size } from '../network/geometry';
import { nearestOnRect, type Rect } from '../network/labels';
import { PipeMark } from '../network/PipeMark';
import type { LimitStatus } from '../network/status';
import { StatusBadge } from './sprites';
import { CHIP_HEIGHT, townLabels } from './townLabels';

interface TownOverlayProps {
  town: Town;
  scenario: Scenario;
  diameters: Diameters;
  evaluation: StageEvaluation | null;
  pipeStatus: Record<string, LimitStatus>;
  service: Record<string, ServiceStatus>;
  selection: Selection;
  size: Size;
  scale: number;
  /** Plan (m) to screen (px). */
  project: (point: Point) => Point;
  /** Areas of the canvas taken by controls. */
  blocked: readonly Rect[];
  /** Delay (s) of each node chip in the success sequence. */
  delays: Record<string, number>;
}

/**
 * Screen-space layer over the town: flow arrows, the marks of pipes outside the velocity
 * limits, the status chips of the nodes and the labels of pipes, reservoirs and pumps, all at a
 * constant size. What they say and where they go is decided in townLabels.ts. The layer
 * ignores the pointer; the elements below stay the targets.
 */
export function TownOverlay({ delays, ...input }: TownOverlayProps) {
  const num = useNum();
  const { pills, arrows, marks } = townLabels({ ...input, num });

  return (
    <g className="town__overlay" aria-hidden="true">
      {arrows.map((arrow) => (
        <polygon
          key={arrow.id}
          className={`town__arrow netview__pipe--${arrow.status}`}
          points={`${-arrow.head},${-arrow.head} ${arrow.head + 2},0 ${-arrow.head},${arrow.head}`}
          transform={`translate(${arrow.at.x.toFixed(1)} ${arrow.at.y.toFixed(1)}) rotate(${arrow.angle.toFixed(1)})`}
        />
      ))}
      {marks.map((mark) => (
        <g key={mark.id} className={`netview__pipe--${mark.status}`}>
          <PipeMark at={mark.at} status={mark.status} />
        </g>
      ))}
      {pills.map(({ leader, rect }, index) => {
        if (!leader) return null;
        const end = nearestOnRect(leader, rect);
        return (
          <line
            key={index}
            className="town__leader"
            x1={leader.x.toFixed(1)}
            y1={leader.y.toFixed(1)}
            x2={end.x.toFixed(1)}
            y2={end.y.toFixed(1)}
          />
        );
      })}
      {pills.map(({ rect, pill, leader }) => {
        const site = pill.kind === 'reservoir' || pill.kind === 'pump';
        const className = [
          'town__pill',
          `town__pill--${site ? 'site' : pill.kind}`,
          `town__pill--${pill.status}`,
          pill.selected && 'town__pill--selected',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={`${pill.kind}:${pill.id}`}
            className={className}
            data-label=""
            data-label-kind={pill.kind}
            data-label-for={pill.id}
            data-leader={leader ? 'true' : undefined}
            transform={`translate(${rect.x.toFixed(1)} ${rect.y.toFixed(1)})`}
            style={
              pill.kind === 'node'
                ? ({ '--town-delay': `${(delays[pill.id] ?? 0).toFixed(3)}s` } as CSSProperties)
                : undefined
            }
          >
            <rect
              className="town__pill-box"
              width={rect.width}
              height={rect.height}
              rx={pill.kind === 'node' ? rect.height / 2 : 5}
            />
            {pill.icon && (
              <g transform={`translate(${CHIP_HEIGHT / 2} ${CHIP_HEIGHT / 2})`}>
                <StatusBadge status={pill.icon} />
              </g>
            )}
            <text className="town__pill-text" x={pill.icon ? 23 : 7} y={rect.height / 2 + 4.2}>
              <tspan className="town__pill-id">{pill.strong}</tspan>
              {pill.rest && <tspan className="town__pill-rest"> {pill.rest}</tspan>}
            </text>
          </g>
        );
      })}
    </g>
  );
}
