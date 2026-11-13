import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { housesSummary, serviceStatuses } from '../../game/houses';
import { fillOrder, generateTown, type Town } from '../../game/town';
import { useTr } from '../../i18n';
import type { Scenario } from '../../scenarios/types';
import { useAppStore, type Selection } from '../../state/store';
import { IconStale } from '../shell/icons';
import { useNum } from '../network/format';
import { fitToSize, toScreen, type Point, type View } from '../network/geometry';
import type { Rect } from '../network/labels';
import { Legend } from '../network/Legend';
import { pipeStatuses } from '../network/status';
import { networkStrings } from '../network/strings';
import { usePanZoom } from '../network/usePanZoom';
import { SelectionBar, ZoomControls } from '../network/ViewControls';
import { StatusBadge } from './sprites';
import { townStrings as text } from './strings';
import { lightDelays, TownNetwork } from './TownNetwork';
import { TownOverlay } from './TownOverlay';
import { TownScenery } from './TownScenery';
import { useReducedMotion } from './useReducedMotion';
import '../network/network.css';
import './town.css';

type ElementType = NonNullable<Selection>['type'];

/** How long the success sequence and the failure highlight stay on, ms. */
const SUCCESS_MS = 2200;
const FAILURE_MS = 2600;
/** A failing node this close (px) to the edge of the canvas counts as out of view. */
const VIEW_MARGIN = 48;
/** Zoom above which the view pulls back to show the worst node in its surroundings. */
const CLOSE_ZOOM = 1.5;
const PAN_MS = 320;

const towns = new WeakMap<Scenario, Town>();

/** The generated town of a scenario; generated once per scenario object. */
function townOf(scenario: Scenario): Town {
  let town = towns.get(scenario);
  if (!town) {
    town = generateTown(scenario);
    towns.set(scenario, town);
  }
  return town;
}

interface Feedback {
  kind: 'success' | 'failure';
  /** The `verifiedAt` that started it. */
  key: number;
}

/**
 * Illustrated town of the open stage: streets over the pipes, the houses of every demand node
 * and the reservoir. Same selection, results and diameter picker as the schematic.
 */
export function TownView() {
  const tr = useTr();
  const num = useNum();
  const scenario = useAppStore((s) => s.scenario);
  const diameters = useAppStore((s) => s.diameters);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const verifiedAt = useAppStore((s) => s.verifiedAt);

  const helpId = useId();
  const reducedMotion = useReducedMotion();
  const { canvasRef, svgRef, size, view, setView, zoomBy, reset, consumeDrag, handlers } =
    usePanZoom();

  const town = useMemo(() => (scenario ? townOf(scenario) : null), [scenario]);
  const order = useMemo(() => (scenario ? fillOrder(scenario) : null), [scenario]);
  const narrow = size.width < 480;
  const fit = useMemo(() => {
    const focus = town?.focus ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    return fitToSize(
      [
        { x: focus.minX, y: focus.minY },
        { x: focus.maxX, y: focus.maxY },
      ],
      size,
      { x: narrow ? 12 : 28, y: narrow ? 46 : 52 },
    );
  }, [town, size, narrow]);
  const service = useMemo(
    () => (scenario ? serviceStatuses(scenario, evaluation) : {}),
    [scenario, evaluation],
  );
  const pipeStatus = useMemo(
    () => (scenario ? pipeStatuses(evaluation, scenario.checks) : {}),
    [evaluation, scenario],
  );
  const delays = useMemo(
    () => (scenario && order ? lightDelays(scenario, order) : {}),
    [scenario, order],
  );

  // Feedback starts only when the player runs "Calcular / Verificar": `verifiedAt` changes
  // then, and not when a stage opens or this view is mounted again.
  const [seenVerify, setSeenVerify] = useState(verifiedAt);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  if (verifiedAt !== seenVerify) {
    setSeenVerify(verifiedAt);
    setFeedback(
      verifiedAt !== null && evaluation
        ? { kind: evaluation.passed ? 'success' : 'failure', key: verifiedAt }
        : null,
    );
  }

  const latest = useRef({ scenario, evaluation, fit, size, view, reducedMotion });
  useEffect(() => {
    latest.current = { scenario, evaluation, fit, size, view, reducedMotion };
  });

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(
      () => setFeedback((current) => (current?.key === feedback.key ? null : current)),
      feedback.kind === 'success' ? SUCCESS_MS : FAILURE_MS,
    );
    let frame = 0;
    if (feedback.kind === 'failure') {
      const now = latest.current;
      const worst = now.scenario && housesSummary(now.scenario, now.evaluation).worstNodeId;
      const node = now.scenario?.nodes.find((n) => n.id === worst);
      if (node) {
        const p = toScreen(node, now.fit, now.view, now.size);
        const inView =
          p.x >= VIEW_MARGIN &&
          p.x <= now.size.width - VIEW_MARGIN &&
          p.y >= VIEW_MARGIN &&
          p.y <= now.size.height - VIEW_MARGIN;
        if (!inView || now.view.k > CLOSE_ZOOM) {
          const k = Math.min(now.view.k, CLOSE_ZOOM);
          const target: View = {
            k,
            x: -(node.x - now.fit.center.x) * now.fit.scale * k,
            y: -(node.y - now.fit.center.y) * now.fit.scale * k,
          };
          if (now.reducedMotion || typeof requestAnimationFrame === 'undefined') {
            setView(target);
          } else {
            const from = now.view;
            const started = performance.now();
            const step = (time: number) => {
              const t = Math.min(1, (time - started) / PAN_MS);
              const eased = 1 - (1 - t) ** 3;
              setView({
                k: from.k + (target.k - from.k) * eased,
                x: from.x + (target.x - from.x) * eased,
                y: from.y + (target.y - from.y) * eased,
              });
              if (t < 1) frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
          }
        }
      }
    }
    return () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [feedback, setView]);

  if (!scenario || !town || !order) return null;

  const scale = fit.scale * view.k;
  const origin = toScreen({ x: 0, y: 0 }, fit, view, size);
  const project = (point: Point): Point => ({
    x: origin.x + point.x * scale,
    y: origin.y + point.y * scale,
  });

  const pick = (target: EventTarget | null): Selection => {
    const element = (target as Element | null)?.closest?.('[data-element]');
    const type = element?.getAttribute('data-element') as ElementType | undefined;
    const id = element?.getAttribute('data-id');
    if (type && id) return { type, id };
    const node = (target as Element | null)?.closest?.('[data-node-hit]');
    const nodeId = node?.getAttribute('data-node-hit');
    return nodeId ? { type: 'node', id: nodeId } : null;
  };

  const onClick = (event: MouseEvent<SVGSVGElement>) => {
    if (consumeDrag()) return;
    select(pick(event.target));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const picked = pick(event.target);
      if (!picked) return;
      event.preventDefault();
      select(picked);
    } else if (event.key === 'Escape' && selection) {
      select(null);
    }
  };

  const hint = stale
    ? networkStrings.staleHint
    : !evaluation && !solving
      ? networkStrings.notSolvedHint
      : null;
  const blocked: Rect[] = [{ x: size.width - 116, y: 0, width: 116, height: 44 }];
  if (hint) blocked.push({ x: 0, y: 0, width: Math.max(0, size.width - 136), height: 38 });
  const celebrating = feedback?.kind === 'success' && !reducedMotion;
  const rootClass = ['town', stale && 'town--stale'].filter(Boolean).join(' ');
  const limits = NBR_CHECK_LIMITS;

  return (
    <div
      className={rootClass}
      data-feedback={feedback?.kind ?? 'none'}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    >
      <div
        className={`town__canvas town__canvas--base-${Math.min(6, town.terrain?.base ?? 0)}`}
        ref={canvasRef}
      >
        <svg
          ref={svgRef}
          className="town__svg"
          role="group"
          aria-label={tr(text.drawing)}
          aria-describedby={helpId}
          onClick={onClick}
          onKeyDown={onKeyDown}
          {...handlers}
        >
          <g
            className="town__world"
            transform={`translate(${origin.x.toFixed(2)} ${origin.y.toFixed(2)}) scale(${scale.toFixed(5)})`}
          >
            <TownScenery town={town} />
            <TownNetwork
              town={town}
              scenario={scenario}
              diameters={diameters}
              evaluation={evaluation}
              pipeStatus={pipeStatus}
              service={service}
              selection={selection}
              stale={stale}
              scale={scale}
              order={order}
              celebrating={celebrating}
            />
          </g>
          <TownOverlay
            town={town}
            scenario={scenario}
            diameters={diameters}
            evaluation={evaluation}
            pipeStatus={pipeStatus}
            service={service}
            selection={selection}
            size={size}
            scale={scale}
            project={project}
            blocked={blocked}
            delays={delays}
          />
        </svg>

        <p id={helpId} className="visually-hidden">
          {tr(text.drawingHelp)}
        </p>

        {hint && (
          <p className="netview__hint" role="status">
            <span className={stale ? 'badge badge--warn' : 'badge badge--info'}>
              {stale && <IconStale />}
              {tr(hint)}
            </span>
          </p>
        )}

        <ZoomControls onZoom={zoomBy} onFit={reset} />
      </div>

      <SelectionBar />

      <Legend
        checks={scenario.checks}
        evaluated={evaluation !== null}
        nodeSwatch={(status) =>
          status === 'none' ? null : (
            <svg className="netview__swatch" viewBox="-11 -11 22 22" aria-hidden="true">
              <StatusBadge status={status} />
            </svg>
          )
        }
        nodeText={{
          ok: tr(text.legendServed),
          low: tr(text.legendLow(num(limits.minDynamicPressure, 0))),
          high: tr(text.legendHigh(num(limits.maxStaticPressure, 0))),
        }}
      />
    </div>
  );
}
