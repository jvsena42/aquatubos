import type { ReactNode } from 'react';
import { useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { IconStale } from '../shell/icons';
import { DnPicker } from './DnPicker';
import { useNum } from './format';
import type { StripOrientation } from './mapLayout';
import { networkStrings as text } from './strings';

interface ControlStripProps {
  /** Row or column, chosen with the fit by `layoutMap`. */
  orientation: StripOrientation;
  onZoom: (factor: number) => void;
  onFit: () => void;
  /** Extra controls before the zoom buttons (the legend help on phones), one slot each. */
  children?: ReactNode;
}

/**
 * The controls shown over a drawing, as one strip of icon buttons in the top right corner. Every
 * control carries `data-overlay-control`; the fit keeps the network out from under the strip
 * (see mapLayout.ts).
 */
export function ControlStrip({ orientation, onZoom, onFit, children }: ControlStripProps) {
  const tr = useTr();
  return (
    <div
      className="netview__strip"
      data-orientation={orientation}
      role="group"
      aria-label={tr(text.mapControls)}
    >
      {children}
      <button
        type="button"
        className="netview__ctl"
        data-overlay-control="zoom-in"
        aria-label={tr(text.zoomIn)}
        title={tr(text.zoomIn)}
        onClick={() => onZoom(1.4)}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        className="netview__ctl"
        data-overlay-control="zoom-out"
        aria-label={tr(text.zoomOut)}
        title={tr(text.zoomOut)}
        onClick={() => onZoom(1 / 1.4)}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        className="netview__ctl"
        data-overlay-control="fit"
        aria-label={tr(text.fit)}
        title={tr(text.fit)}
        onClick={onFit}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
        </svg>
      </button>
    </div>
  );
}

/** Short state of the results under a drawing: outdated, or not calculated yet. */
export function ResultBadge({ iconOnly = false }: { iconOnly?: boolean }) {
  const tr = useTr();
  const stale = useAppStore((s) => s.stale);
  const pending = useAppStore((s) => !s.evaluation && !s.solving);
  if (!stale && !pending) return null;
  const full = tr(stale ? text.staleHint : text.notSolvedHint);
  return (
    <p className="netview__state" role="status" title={full}>
      <span className={stale ? 'badge badge--warn' : 'badge badge--info'}>
        {stale && <IconStale />}
        {!iconOnly && (
          <span aria-hidden="true">{tr(stale ? text.staleShort : text.notSolvedShort)}</span>
        )}
        <span className="visually-hidden">{full}</span>
      </span>
    </p>
  );
}

interface MapFootProps {
  phone: boolean;
  /** Icon legend of the drawing. */
  legend: ReactNode;
  /** Legend help; on phones it is in the control strip instead. */
  help?: ReactNode;
}

/**
 * The one row under a drawing.
 *
 * Phones: the diameter keys of the selected pipe (`#dn-bar`, the only picker on a phone), or,
 * with no pipe selected, a short hint and the icon legend. The row keeps its height so the
 * drawing does not jump when the selection changes.
 *
 * Tablets and desktops: the icon legend, its help and the state of the results. The picker is
 * in the calculation panel next to the drawing.
 */
export function MapFoot({ phone, legend, help }: MapFootProps) {
  const tr = useTr();
  const num = useNum();
  const pipe = useAppStore((s) =>
    s.selection?.type === 'pipe'
      ? s.scenario?.pipes.find((p) => p.id === s.selection?.id)
      : undefined,
  );
  if (!phone) {
    return (
      <div className="netview__foot">
        {legend}
        {help}
        <ResultBadge />
      </div>
    );
  }
  if (!pipe) {
    return (
      <div className="netview__foot netview__foot--phone">
        <ResultBadge iconOnly />
        <span className="muted netview__foot-hint">{tr(text.selectHint)}</span>
        {legend}
      </div>
    );
  }
  return (
    <div className="netview__foot netview__foot--phone netview__foot--pipe">
      <span className="netview__foot-title">
        <span className="visually-hidden">{tr(text.pipeLength(pipe.id, num(pipe.length, 0)))}</span>
        <strong aria-hidden="true">{pipe.id}</strong>
        <span className="muted num" aria-hidden="true">
          {num(pipe.length, 0)} m
        </span>
      </span>
      <DnPicker pipeId={pipe.id} variant="bar" id="dn-bar" />
    </div>
  );
}
