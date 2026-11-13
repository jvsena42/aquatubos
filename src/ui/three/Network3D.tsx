import { Component, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { TermScope } from '../glossary/TermScope';
import { HelpButton } from '../shell/Help';
import { DEFAULT_EXAGGERATION, EXAGGERATIONS, type Exaggeration } from './geometry';
import { buildSceneModel } from './model';
import { buildLabels, type Label, type LabelTexts } from './labels';
import Scene3D from './Scene3D';
import { criticalNode } from './status';
import { HEAD_UNIT, statusLabels, strings3d } from './strings';
import { useThemeColors } from './useThemeColors';
import { useViewProfile } from './viewProfile';
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
  const profile = useViewProfile();
  const { compact, touch } = profile;

  // A result of another stage (or none) is ignored: the scene then shows the network only.
  const current =
    evaluation && scenario && evaluation.scenarioId === scenario.id ? evaluation : null;
  const model = useMemo(
    () =>
      scenario
        ? buildSceneModel(scenario, diameters, current, exaggeration, profile.quality)
        : null,
    [scenario, diameters, current, exaggeration, profile.quality],
  );
  const hasResult = model?.hgl != null;

  const unit = tr(HEAD_UNIT);
  const criticalId = criticalNode(current)?.id ?? null;
  const labels = useMemo<Label[]>(() => {
    if (!model || !showLabels) return [];
    const texts: LabelTexts = {
      pipe: (dn) => `DN ${dn}`,
      node: (id, pressure) => (pressure === null ? id : `${id} · ${format(pressure, 1)} ${unit}`),
      nodeCompact: (id, pressure) => (pressure === null ? id : `${id} · ${format(pressure, 1)}`),
      reservoir: (id, level) => `${id} · ${format(level, 1)} m`,
      pump: (id) => id,
    };
    return buildLabels(model, texts, { compact, selection, criticalId });
  }, [model, showLabels, format, unit, compact, selection, criticalId]);

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
  // One short line under the toolbar; the sentence is in the help and for screen readers.
  const brief = critical
    ? tr(
        strings3d.summaryShort(
          critical.id,
          format(critical.pressure, 1),
          format(minimum, 0),
          critical.pressure >= minimum,
        ),
      )
    : tr(strings3d.noResultShort);

  const legend = (
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
  );
  const hint = (
    <p className="net3d__hint muted">{tr(touch ? strings3d.hintTouch : strings3d.hint)}</p>
  );

  return (
    <TermScope>
      <div className={`net3d${compact ? ' net3d--compact' : ''}`}>
        {webgl && (
          <div className="net3d__toolbar" role="group" aria-label={tr(strings3d.controls)}>
            <div className="net3d__field">
              <span className="muted" aria-hidden>
                {tr(strings3d.exaggerationShort)}
              </span>
              <div className="segmented" role="group" aria-label={tr(strings3d.exaggeration)}>
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
                aria-label={tr(strings3d.hgl)}
                title={tr(strings3d.hgl)}
                onClick={() => setShowHgl((on) => !on)}
              >
                {tr(strings3d.hglShort)}
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
              className="btn btn--sm net3d__reset"
              aria-label={tr(strings3d.resetView)}
              onClick={() => setResetCount((count) => count + 1)}
            >
              {tr(strings3d.resetShort)}
            </button>
            <HelpButton topic={tr(strings3d.helpTopic)} className="net3d__help">
              {hint}
              {legend}
              <p>{summary}</p>
            </HelpButton>
          </div>
        )}

        <div className="net3d__viewport">
          {webgl ? (
            <SceneBoundary onError={() => setFailed(true)}>
              <div className="net3d__canvas">
                <Scene3D
                  model={model}
                  profile={profile}
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
                    {label.short === undefined ? (
                      label.text
                    ) : (
                      <>
                        <span className="net3d__label-full">{label.text}</span>
                        <span className="net3d__label-short">{label.short}</span>
                      </>
                    )}
                  </span>
                ))}
              </div>
              <p className="net3d__scale">{tr(strings3d.scaleNote(exaggeration))}</p>
              {stale && hasResult && (
                <p className="net3d__note" role="status" title={tr(strings3d.stale)}>
                  <span aria-hidden="true">{tr(strings3d.staleShort)}</span>
                  <span className="visually-hidden">{tr(strings3d.stale)}</span>
                </p>
              )}
            </SceneBoundary>
          ) : (
            <p className="net3d__fallback" role="status">
              {tr(strings3d.noWebgl)}
            </p>
          )}
        </div>

        {/* Without WebGL this line is the text alternative of the scene: the whole sentence. */}
        <p className="net3d__summary">
          {webgl ? (
            <>
              <span aria-hidden="true">{brief}</span>
              <span className="visually-hidden">{summary}</span>
            </>
          ) : (
            summary
          )}
        </p>
      </div>
    </TermScope>
  );
}
