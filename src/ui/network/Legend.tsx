import type { ReactNode } from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import type { CheckSettings } from '../../engine/types';
import { useTr } from '../../i18n';
import { HelpButton } from '../shell/Help';
import { useNum } from './format';
import type { LimitStatus } from './status';
import { networkStrings as text } from './strings';

export interface LegendProps {
  checks: CheckSettings;
  /** False before the first solve: only the neutral entries make sense. */
  evaluated: boolean;
  /** Replaces the node symbols (the town view shows its status badges). */
  nodeSwatch?: (status: LimitStatus) => ReactNode;
  /** Replaces the texts of the three pressure entries. */
  nodeText?: Partial<Record<'ok' | 'low' | 'high', string>>;
  /**
   * Shows the three node states always, also before a result and when a check is off in the
   * stage (the town: its house states are the vocabulary of the map).
   */
  allNodeStates?: boolean;
}

interface LegendEntry {
  key: string;
  swatch: ReactNode;
  text: string;
}

function NodeSwatch({ status }: { status: LimitStatus }) {
  const s = status === 'low' ? 1 : -1;
  return (
    <svg className="netview__swatch" viewBox="0 0 24 24" aria-hidden="true">
      <g className={`netview__node netview__node--${status}`}>
        <circle className="netview__node-dot" cx={12} cy={12} r={status === 'ok' ? 8 : 10} />
        {(status === 'low' || status === 'high') && (
          <polygon
            className="netview__glyph"
            points={`7.5,${12 - 3 * s} 16.5,${12 - 3 * s} 12,${12 + 4.5 * s}`}
          />
        )}
      </g>
    </svg>
  );
}

/** A piece of pipe in a velocity colour; outside the limits it carries the mark of the map. */
function PipeSwatch({ status }: { status: LimitStatus }) {
  const s = status === 'low' ? 1 : -1;
  return (
    <svg className="netview__swatch netview__swatch--wide" viewBox="0 0 32 24" aria-hidden="true">
      <g className={`netview__pipe netview__pipe--${status}`}>
        <line className="netview__pipe-line" x1={3} y1={12} x2={29} y2={12} strokeWidth={6} />
        {(status === 'low' || status === 'high') && (
          <g className="netview__pipe-mark" transform="translate(16 12)">
            <circle r={6.5} />
            <polygon points={`-3.6,${-2.4 * s} 3.6,${-2.4 * s} 0,${3.6 * s}`} />
          </g>
        )}
      </g>
    </svg>
  );
}

/** The entries of the legend of a drawing; they follow the checks of the stage. */
function useLegendEntries({
  checks,
  evaluated,
  nodeSwatch,
  nodeText,
  allNodeStates = false,
}: LegendProps): LegendEntry[] {
  const tr = useTr();
  const num = useNum();
  const limits = NBR_CHECK_LIMITS;
  const minPressure = allNodeStates || (evaluated && checks.minDynamicPressure !== 'off');
  const maxStatic = allNodeStates || (evaluated && checks.maxStaticPressure !== 'off');
  const minVelocity = evaluated && checks.minVelocity !== 'off';
  const maxVelocity = evaluated && checks.maxVelocity !== 'off';
  const swatch = (status: LimitStatus) =>
    nodeSwatch ? nodeSwatch(status) : <NodeSwatch status={status} />;

  const entries: LegendEntry[] = [];
  if (minPressure || maxStatic) {
    entries.push({
      key: 'node-ok',
      swatch: swatch('ok'),
      text: nodeText?.ok ?? tr(text.legendPressureOk),
    });
  }
  if (minPressure) {
    entries.push({
      key: 'node-low',
      swatch: swatch('low'),
      text: nodeText?.low ?? tr(text.legendPressureLow(num(limits.minDynamicPressure, 0))),
    });
  }
  if (maxStatic) {
    entries.push({
      key: 'node-high',
      swatch: swatch('high'),
      text: nodeText?.high ?? tr(text.legendPressureHigh(num(limits.maxStaticPressure, 0))),
    });
  }
  if (minVelocity) {
    entries.push({
      key: 'pipe-low',
      swatch: <PipeSwatch status="low" />,
      text: tr(text.legendVelocityLow(num(limits.minVelocity, 1))),
    });
  }
  if (minVelocity || maxVelocity) {
    entries.push({
      key: 'pipe-ok',
      swatch: <PipeSwatch status="ok" />,
      text:
        minVelocity && maxVelocity
          ? tr(text.legendVelocityOk(num(limits.minVelocity, 1), num(limits.maxVelocity, 1)))
          : tr(text.legendVelocityOkOnly),
    });
  }
  if (maxVelocity) {
    entries.push({
      key: 'pipe-high',
      swatch: <PipeSwatch status="high" />,
      text: tr(text.legendVelocityHigh(num(limits.maxVelocity, 1))),
    });
  }
  if (evaluated) {
    entries.push({
      key: 'direction',
      swatch: (
        <svg
          className="netview__swatch netview__swatch--wide"
          viewBox="0 0 32 24"
          aria-hidden="true"
        >
          <g className="netview__pipe netview__pipe--none">
            <line className="netview__pipe-line" x1={3} y1={12} x2={29} y2={12} strokeWidth={4} />
            <polygon className="netview__arrow" points="11,6 22,12 11,18" />
          </g>
        </svg>
      ),
      text: tr(text.legendDirection),
    });
  }
  entries.push({
    key: 'width',
    swatch: (
      <svg className="netview__swatch netview__swatch--wide" viewBox="0 0 32 24" aria-hidden="true">
        <g className="netview__pipe netview__pipe--none">
          <line className="netview__pipe-line" x1={3} y1={7} x2={29} y2={7} strokeWidth={3} />
          <line className="netview__pipe-line" x1={3} y1={17} x2={29} y2={17} strokeWidth={7} />
        </g>
      </svg>
    ),
    text: tr(text.legendWidth),
  });
  return entries;
}

/**
 * The legend as a strip of symbols without text. Each symbol has its meaning as a tooltip and
 * as its accessible name; the texts are in `LegendHelp`.
 */
export function LegendIcons(props: LegendProps) {
  const tr = useTr();
  const entries = useLegendEntries(props);
  return (
    <ul className="netview__legend-icons" aria-label={tr(text.legend)}>
      {entries.map((entry) => (
        <li key={entry.key} data-entry={entry.key} title={entry.text}>
          <span role="img" aria-label={entry.text}>
            {entry.swatch}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The "?" of the legend: every symbol with its text, and what the labels and gestures are. */
export function LegendHelp(props: LegendProps & { className?: string }) {
  const tr = useTr();
  const entries = useLegendEntries(props);
  return (
    <HelpButton topic={tr(text.legend)} className={props.className}>
      <ul className="netview__legend">
        {entries.map((entry) => (
          <li key={entry.key} data-entry={entry.key}>
            {entry.swatch}
            <span>{entry.text}</span>
          </li>
        ))}
      </ul>
      <p className="netview__legend-note">{tr(text.legendLabels)}</p>
      <p className="netview__legend-note">{tr(text.legendGestures)}</p>
    </HelpButton>
  );
}
