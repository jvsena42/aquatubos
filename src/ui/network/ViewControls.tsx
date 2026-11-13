import { useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { DnPicker } from './DnPicker';
import { usePhone } from '../shell/breakpoints';
import { useNum } from './format';
import { networkStrings as text } from './strings';

/**
 * Area (px) at the top right of a drawing taken by the zoom controls, which labels must keep
 * clear: three buttons of 32 px, or of 44 px where the pointer is a finger.
 */
export function zoomControlsArea(touch: boolean): { width: number; height: number } {
  return touch ? { width: 152, height: 56 } : { width: 116, height: 44 };
}

interface ZoomControlsProps {
  onZoom: (factor: number) => void;
  onFit: () => void;
}

/** Zoom in, zoom out and fit buttons shown over a drawing. */
export function ZoomControls({ onZoom, onFit }: ZoomControlsProps) {
  const tr = useTr();
  return (
    <div className="netview__zoom" role="group" aria-label={tr(text.zoomControls)}>
      <button
        type="button"
        className="btn btn--sm btn--icon"
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
        className="btn btn--sm btn--icon"
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
        className="btn btn--sm btn--icon"
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

/**
 * Row under a drawing with the diameter options of the selected pipe. It is always there, so
 * the drawing does not jump when the selection changes.
 */
export function SelectionBar() {
  const tr = useTr();
  const num = useNum();
  const phone = usePhone();
  const pipe = useAppStore((s) =>
    s.selection?.type === 'pipe'
      ? s.scenario?.pipes.find((p) => p.id === s.selection?.id)
      : undefined,
  );
  return (
    <div className={phone ? 'netview__bar netview__bar--phone' : 'netview__bar'}>
      {pipe ? (
        <>
          <span className="netview__bar-title">
            {tr(text.pipe(pipe.id))}
            <span className="muted num">
              {' '}
              · {num(pipe.length, 0)} m{!phone && ' · DN'}
            </span>
            {phone && <span className="muted netview__bar-unit">{tr(text.dnPriceUnit)}</span>}
          </span>
          <DnPicker pipeId={pipe.id} compact prices={phone} />
        </>
      ) : (
        <span className="muted">{tr(text.selectHint)}</span>
      )}
    </div>
  );
}
