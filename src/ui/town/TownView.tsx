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
import { housesSummary, serviceStatuses, type ServiceStatus } from '../../game/houses';
import { fillOrder, generateTown, type Town } from '../../game/town';
import { useTr } from '../../i18n';
import type { Scenario } from '../../scenarios/types';
import { useAppStore, type Selection } from '../../state/store';
import { TermScope } from '../glossary/TermScope';
import { useNum } from '../network/format';
import { toScreen, type Point, type View } from '../network/geometry';
import {
  HIT_PRIORITY,
  hitTargetSize,
  NODE_CLAIM,
  resolveHit,
  trimSegment,
  type HitShape,
  type HitTarget,
} from '../network/hit';
import { LegendHelp, LegendIcons } from '../network/Legend';
import { layoutMap } from '../network/mapLayout';
import { pipeStatuses, type LimitStatus } from '../network/status';
import { useCoarsePointer, usePhone } from '../shell/breakpoints';
import { usePanZoom } from '../network/usePanZoom';
import { ControlStrip, MapFoot } from '../network/ViewControls';
import { detailClass } from './detail';
import { StatusBadge } from './sprites';
import { townStrings as text } from './strings';
import { lightDelays, TownNetwork } from './TownNetwork';
import { TownOverlay } from './TownOverlay';
import { townBounds, townObstacles, townPadding } from './townLabels';
import { TownScenery } from './TownScenery';
import { useReducedMotion } from './useReducedMotion';
import '../network/network.css';
import './town.css';

type ElementType = NonNullable<Selection>['type'];

/** How long the success sequence and the failure highlight stay on, ms. */
const SUCCESS_MS = 2200;
const FAILURE_MS = 2600;
/** Added (px) to the tap distance of a house: a street next to it is the likelier target. */
const HOUSE_BIAS = 6;
/** Radius (px) around the junction of a node that is the node and not its pipes. */
const NODE_RADIUS = 10;
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

/**
 * Review aid, not part of play: with `?debug=high-static` in the address the houses are drawn
 * in the three service states in turn (served, dry taps, burst risk), whatever the results
 * are. The burst-risk state needs a static pressure above 40 mca, which no stage reaches, so
 * this is the way to see it in a browser. Nothing in the app links to it.
 */
export function housePreview(search?: string): boolean {
  const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
  return new URLSearchParams(query).get('debug') === 'high-static';
}

const PREVIEW_CYCLE: ServiceStatus[] = ['high', 'low', 'ok'];

/** The three house states in turn over the demand nodes, for `housePreview`. */
export function previewStatuses(scenario: Scenario): Record<string, ServiceStatus> {
  const statuses: Record<string, ServiceStatus> = {};
  let index = 0;
  for (const node of scenario.nodes) {
    statuses[node.id] = node.demandLps > 0 ? PREVIEW_CYCLE[index++ % 3]! : 'ok';
  }
  return statuses;
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
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const verifiedAt = useAppStore((s) => s.verifiedAt);

  const helpId = useId();
  const reducedMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const phone = usePhone();
  const { canvasRef, svgRef, size, view, setView, zoomBy, reset, consumeTap, handlers } =
    usePanZoom();

  const town = useMemo(() => (scenario ? townOf(scenario) : null), [scenario]);
  const order = useMemo(() => (scenario ? fillOrder(scenario) : null), [scenario]);
  // On phones the legend help is the fourth control of the strip.
  const slots = phone ? 4 : 3;
  const layout = useMemo(
    () =>
      scenario && town
        ? layoutMap({
            bounds: townBounds(town),
            obstacles: townObstacles(town, scenario, coarse),
            size,
            padding: townPadding(size),
            slots,
          })
        : null,
    [scenario, town, coarse, size, slots],
  );
  const fit = useMemo(() => layout?.fit ?? { scale: 1, center: { x: 0, y: 0 } }, [layout]);
  const preview = useMemo(() => housePreview(), []);
  const service = useMemo(
    () =>
      scenario ? (preview ? previewStatuses(scenario) : serviceStatuses(scenario, evaluation)) : {},
    [scenario, evaluation, preview],
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

  if (!scenario || !town || !order || !layout) return null;

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

  /** What every element draws, in screen px, for the tap resolution (see hit.ts). */
  const hitTargets = (): HitTarget<NonNullable<Selection>>[] => {
    const targets: HitTarget<NonNullable<Selection>>[] = [];
    const at = new Map(
      [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, project({ x: n.x, y: n.y })]),
    );
    for (const street of town.streets) {
      if (street.kind !== 'pipe') continue;
      targets.push({
        data: { type: 'pipe', id: street.id },
        priority: HIT_PRIORITY.pipe,
        shapes: [
          {
            kind: 'capsule',
            ...trimSegment(project(street.a), project(street.b), NODE_CLAIM),
            half: Math.max(3, (street.width * scale) / 2),
          },
        ],
      });
    }
    for (const node of scenario.nodes) {
      const p = at.get(node.id)!;
      const plaza = town.plazas.find((item) => item.nodeId === node.id);
      const shapes: HitShape[] = [
        { kind: 'disc', ...p, r: Math.max(NODE_RADIUS, (plaza?.radius ?? 0) * scale) },
      ];
      for (const house of town.clusters.find((c) => c.nodeId === node.id)?.houses ?? []) {
        shapes.push({
          kind: 'disc',
          ...project(house),
          r: (Math.min(house.w, house.d) * scale) / 2,
          bias: HOUSE_BIAS,
        });
      }
      targets.push({ data: { type: 'node', id: node.id }, priority: HIT_PRIORITY.node, shapes });
    }
    for (const site of town.reservoirs) {
      targets.push({
        data: { type: 'reservoir', id: site.id },
        priority: HIT_PRIORITY.reservoir,
        shapes: [{ kind: 'disc', ...project(site), r: Math.max(NODE_RADIUS, site.radius * scale) }],
      });
    }
    for (const pump of scenario.pumps) {
      const house = town.pumps.find((item) => item.id === pump.id);
      const a = at.get(pump.from);
      const b = at.get(pump.to);
      if (!house || !a || !b) continue;
      targets.push({
        data: { type: 'pump', id: pump.id },
        priority: HIT_PRIORITY.pump,
        shapes: [
          {
            kind: 'disc',
            ...project(house),
            r: Math.max(NODE_RADIUS, (Math.max(house.w, house.d) * scale) / 2),
          },
          { kind: 'capsule', ...trimSegment(a, b, NODE_CLAIM), half: 2 },
        ],
      });
    }
    return targets;
  };

  const onClick = (event: MouseEvent<SVGSVGElement>) => {
    const tap = consumeTap(event);
    if (!tap) return;
    // Without layout (tests) there is no geometry to measure: the element under the pointer.
    select(tap.point ? resolveHit(tap.point, hitTargets(), tap.reach) : pick(event.target));
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

  const celebrating = feedback?.kind === 'success' && !reducedMotion;
  const rootClass = ['town', detailClass(scale), stale && 'town--stale'].filter(Boolean).join(' ');
  const limits = NBR_CHECK_LIMITS;
  const legend = {
    checks: scenario.checks,
    evaluated: evaluation !== null,
    allNodeStates: true,
    nodeSwatch: (status: LimitStatus) =>
      status === 'none' ? null : (
        <svg className="netview__swatch" viewBox="-11 -11 22 22" aria-hidden="true">
          <StatusBadge status={status} />
        </svg>
      ),
    nodeText: {
      ok: tr(text.legendServed),
      low: tr(text.legendLow(num(limits.minDynamicPressure, 0))),
      high: tr(text.legendHigh(num(limits.maxStaticPressure, 0))),
    },
  };

  return (
    <TermScope>
      <div
        className={rootClass}
        data-preview={preview ? 'house-states' : undefined}
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
                hitTarget={hitTargetSize(coarse)}
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
              blocked={[layout.keepClear]}
              delays={delays}
            />
          </svg>

          <p id={helpId} className="visually-hidden">
            {tr(text.drawingHelp)}
          </p>

          <ControlStrip orientation={layout.orientation} onZoom={zoomBy} onFit={reset}>
            {phone && (
              <span className="netview__ctl-slot" data-overlay-control="legend">
                <LegendHelp {...legend} />
              </span>
            )}
          </ControlStrip>
        </div>

        <MapFoot
          phone={phone}
          legend={<LegendIcons {...legend} />}
          help={<LegendHelp {...legend} className="netview__legend-help" />}
        />
      </div>
    </TermScope>
  );
}
