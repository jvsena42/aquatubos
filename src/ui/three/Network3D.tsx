import { Component, useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { DEFAULT_EXAGGERATION, EXAGGERATIONS, type Exaggeration } from './geometry';
import { buildSceneModel } from './model';
import Scene3D, { type LabelAnchor } from './Scene3D';
import { criticalNode } from './status';
import { HEAD_UNIT, statusLabels, strings3d } from './strings';
import { useThemeColors } from './useThemeColors';
import { isWebGLAvailable } from './webgl';
import './network3d.css';

/** Reports when three.js fails to start or to draw, so the view can show a message instead. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Label extends LabelAnchor {
  /** Id of the pipe, node or reservoir the label belongs to. */
  element: string;
  text: string;
  kind: 'node' | 'pipe' | 'reservoir' | 'pump';
}

const STATUSES = ['low', 'ok', 'high'] as const;

/** 3D view of the open stage: terrain, network and the HGL surface. Reads the store. */
export default function Network3D() {
  const tr = useTr();
  const format = useFormat();
  const scenario = useAppStore((s) => s.scenario);
  const diameters = useAppStore((s) => s.diameters);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);

  const [supported] = useState(isWebGLAvailable);
  const [failed, setFailed] = useState(false);
  const webgl = supported && !failed;
  const [exaggeration, setExaggeration] = useState<Exaggeration>(DEFAULT_EXAGGERATION);
  const [showHgl, setShowHgl] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [resetCount, setResetCount] = useState(0);
  const colors = useThemeColors();
  const exaggerationId = useId();

  // A result of another stage (or none) is ignored: the scene then shows the network only.
  const current =
    evaluation && scenario && evaluation.scenarioId === scenario.id ? evaluation : null;
  const model = useMemo(
    () => (scenario ? buildSceneModel(scenario, diameters, current, exaggeration) : null),
    [scenario, diameters, current, exaggeration],
  );
  const hasResult = model?.hgl != null;

  const unit = tr(HEAD_UNIT);
  const labels = useMemo<Label[]>(() => {
    if (!model || !showLabels) return [];
    return [
      ...model.pipes.map((pipe): Label => {
        const middle = pipe.path[Math.floor(pipe.path.length / 2)] ?? { x: 0, y: 0, z: 0 };
        return {
          id: `pipe-${pipe.id}`,
          element: pipe.id,
          kind: 'pipe',
          position: { ...middle, y: middle.y + pipe.radius * 2 },
          text: `DN ${pipe.dn}`,
        };
      }),
      ...model.nodes.map((node): Label => ({
        id: `node-${node.id}`,
        element: node.id,
        kind: 'node',
        position: { ...node.position, y: node.position.y + node.radius * 1.6 },
        text: node.pressure === null ? node.id : `${node.id} · ${format(node.pressure, 1)} ${unit}`,
      })),
      ...model.reservoirs.map((reservoir): Label => ({
        id: `reservoir-${reservoir.id}`,
        element: reservoir.id,
        kind: 'reservoir',
        position: { ...reservoir.position, y: reservoir.topY },
        text: `${reservoir.id} · ${tr(strings3d.waterLevel(format(reservoir.waterLevel, 1)))}`,
      })),
      ...model.pumps.map((pump): Label => ({
        id: `pump-${pump.id}`,
        element: pump.id,
        kind: 'pump',
        position: { ...pump.marker.position, y: pump.marker.position.y + pump.radius * 8 },
        text: `${pump.id} · ${tr(strings3d.pump)}`,
      })),
    ];
  }, [model, showLabels, format, unit, tr]);

  const labelElements = useRef(new Map<string, HTMLElement>());
  const setLabelElement = useCallback((id: string, element: HTMLElement | null) => {
    if (element) labelElements.current.set(id, element);
    else labelElements.current.delete(id);
  }, []);

  if (!scenario || !model) return null;

  const critical = criticalNode(current);
  const minimum = NBR_CHECK_LIMITS.minDynamicPressure;
  const summary = critical
    ? tr(
        strings3d.summary(
          critical.id,
          format(critical.pressure, 1),
          format(minimum, 0),
          critical.pressure >= minimum,
        ),
      )
    : tr(strings3d.noResult);

  return (
    <div className="net3d">
      {webgl && (
        <div className="net3d__toolbar" role="group" aria-label={tr(strings3d.controls)}>
          <div className="net3d__field">
            <span className="muted" id={exaggerationId}>
              {tr(strings3d.exaggeration)}
            </span>
            <div className="segmented" role="group" aria-labelledby={exaggerationId}>
              {EXAGGERATIONS.map((factor) => (
                <button
                  key={factor}
                  type="button"
                  aria-pressed={exaggeration === factor}
                  aria-label={tr(strings3d.exaggerationOption(factor))}
                  onClick={() => setExaggeration(factor)}
                >
                  {factor}×
                </button>
              ))}
            </div>
          </div>
          <div className="segmented net3d__toggles">
            <button
              type="button"
              aria-pressed={showHgl}
              disabled={!hasResult}
              onClick={() => setShowHgl((on) => !on)}
            >
              {tr(strings3d.hgl)}
            </button>
            <button
              type="button"
              aria-pressed={showLabels}
              onClick={() => setShowLabels((on) => !on)}
            >
              {tr(strings3d.labels)}
            </button>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setResetCount((count) => count + 1)}
          >
            {tr(strings3d.resetView)}
          </button>
        </div>
      )}

      <div className="net3d__viewport">
        {webgl ? (
          <SceneBoundary onError={() => setFailed(true)}>
            <div className="net3d__canvas">
              <Scene3D
                model={model}
                colors={colors}
                selection={selection}
                onSelect={select}
                showHgl={showHgl}
                stale={stale}
                resetCount={resetCount}
                ariaLabel={tr(strings3d.canvasLabel(tr(scenario.title), hasResult))}
                labels={labels}
                labelElements={labelElements}
              />
            </div>
            <div className={`net3d__labels${stale ? ' net3d__labels--stale' : ''}`} aria-hidden>
              {labels.map((label) => (
                <span
                  key={label.id}
                  ref={(element) => setLabelElement(label.id, element)}
                  className={`net3d__label net3d__label--${label.kind}${
                    selection?.type === label.kind && selection.id === label.element
                      ? ' net3d__label--selected'
                      : ''
                  }`}
                >
                  {label.text}
                </span>
              ))}
            </div>
            <p className="net3d__scale">{tr(strings3d.scaleNote(exaggeration))}</p>
            {stale && hasResult && (
              <p className="net3d__note" role="status">
                {tr(strings3d.stale)}
              </p>
            )}
          </SceneBoundary>
        ) : (
          <p className="net3d__fallback" role="status">
            {tr(strings3d.noWebgl)}
          </p>
        )}
      </div>

      {webgl && (
        <ul className="net3d__legend" aria-label={tr(strings3d.legend)}>
          <li>
            <span className="muted">{tr(strings3d.nodePressure)}</span>
            {STATUSES.map((status) => (
              <span key={status} className="net3d__key">
                <span className={`net3d__dot net3d__dot--pressure-${status}`} aria-hidden />
                {tr(statusLabels[status])}
              </span>
            ))}
          </li>
          <li>
            <span className="muted">{tr(strings3d.pipeVelocity)}</span>
            {STATUSES.map((status) => (
              <span key={status} className="net3d__key">
                <span className={`net3d__bar net3d__bar--velocity-${status}`} aria-hidden />
                {tr(statusLabels[status])}
              </span>
            ))}
          </li>
          <li>
            <span className="net3d__key">
              <span className="net3d__swatch net3d__swatch--hgl" aria-hidden />
              {tr(strings3d.hglSurface)}
            </span>
            {model.pumps.length > 0 && (
              <span className="net3d__key">
                <span className="net3d__dot net3d__dot--pump" aria-hidden />
                {tr(strings3d.pump)}
              </span>
            )}
          </li>
        </ul>
      )}

      <p className="net3d__summary">{summary}</p>
      {webgl && <p className="net3d__hint muted">{tr(strings3d.hint)}</p>}
    </div>
  );
}
