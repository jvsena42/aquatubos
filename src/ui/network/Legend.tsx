import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import type { CheckSettings } from '../../engine/types';
import { useTr } from '../../i18n';
import { useNum } from './format';
import type { LimitStatus } from './status';
import { networkStrings as text } from './strings';

interface LegendProps {
  checks: CheckSettings;
  /** False before the first solve: only the neutral entries make sense. */
  evaluated: boolean;
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

function PipeSwatch({ status }: { status: LimitStatus }) {
  return (
    <svg className="netview__swatch netview__swatch--wide" viewBox="0 0 32 24" aria-hidden="true">
      <g className={`netview__pipe netview__pipe--${status}`}>
        <line className="netview__pipe-line" x1={3} y1={12} x2={29} y2={12} strokeWidth={6} />
      </g>
    </svg>
  );
}

/** Explains the colours and marks of the drawing. Entries follow the checks of the stage. */
export function Legend({ checks, evaluated }: LegendProps) {
  const tr = useTr();
  const num = useNum();
  const limits = NBR_CHECK_LIMITS;
  const minPressure = evaluated && checks.minDynamicPressure !== 'off';
  const maxStatic = evaluated && checks.maxStaticPressure !== 'off';
  const minVelocity = evaluated && checks.minVelocity !== 'off';
  const maxVelocity = evaluated && checks.maxVelocity !== 'off';
  const velocity = minVelocity || maxVelocity;

  return (
    <ul className="netview__legend" aria-label={tr(text.legend)}>
      {(minPressure || maxStatic) && (
        <li>
          <NodeSwatch status="ok" />
          {tr(text.legendPressureOk)}
        </li>
      )}
      {minPressure && (
        <li>
          <NodeSwatch status="low" />
          {tr(text.legendPressureLow(num(limits.minDynamicPressure, 0)))}
        </li>
      )}
      {maxStatic && (
        <li>
          <NodeSwatch status="high" />
          {tr(text.legendPressureHigh(num(limits.maxStaticPressure, 0)))}
        </li>
      )}
      {minVelocity && (
        <li>
          <PipeSwatch status="low" />
          {tr(text.legendVelocityLow(num(limits.minVelocity, 1)))}
        </li>
      )}
      {velocity && (
        <li>
          <PipeSwatch status="ok" />
          {minVelocity && maxVelocity
            ? tr(text.legendVelocityOk(num(limits.minVelocity, 1), num(limits.maxVelocity, 1)))
            : tr(text.legendVelocityOkOnly)}
        </li>
      )}
      {maxVelocity && (
        <li>
          <PipeSwatch status="high" />
          {tr(text.legendVelocityHigh(num(limits.maxVelocity, 1)))}
        </li>
      )}
      {evaluated && (
        <li>
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
          {tr(text.legendDirection)}
        </li>
      )}
      <li>
        <svg
          className="netview__swatch netview__swatch--wide"
          viewBox="0 0 32 24"
          aria-hidden="true"
        >
          <g className="netview__pipe netview__pipe--none">
            <line className="netview__pipe-line" x1={3} y1={7} x2={29} y2={7} strokeWidth={3} />
            <line className="netview__pipe-line" x1={3} y1={17} x2={29} y2={17} strokeWidth={7} />
          </g>
        </svg>
        {tr(text.legendWidth)}
      </li>
    </ul>
  );
}
