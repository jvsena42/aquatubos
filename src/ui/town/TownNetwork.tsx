import { memo, type CSSProperties } from 'react';
import { houseCount, type ServiceStatus } from '../../game/houses';
import type { FillOrder, Town, TownCluster } from '../../game/town';
import type { StageEvaluation } from '../../game/types';
import { useTr } from '../../i18n';
import type { Diameters, Scenario } from '../../scenarios/types';
import type { Selection } from '../../state/store';
import { describePipe, describePump, describeReservoir, NO_FLOW } from '../network/describe';
import { useNum } from '../network/format';
import { MOUSE_TARGET } from '../network/hit';
import type { LimitStatus } from '../network/status';
import { HEAD_UNIT, networkStrings, pressureStatusLabels } from '../network/strings';
import { pipeWidth } from './townLabels';
import { House, PumpSprite, ReservoirSprite, shadowPath } from './sprites';
import { serviceLabels, townStrings as text } from './strings';

/** Length of one dash plus one gap of the flow animation, px. */
const DASH_PERIOD = 14;
/** Timeline of the success sequence, s: pipes fill first, then the houses light up. */
export const FILL_SECONDS = 1;
export const LIGHT_START = 0.95;
export const LIGHT_SECONDS = 0.75;

/** Delay (s) after which the houses of each node light up in the success sequence. */
export function lightDelays(scenario: Scenario, order: FillOrder): Record<string, number> {
  const ids = scenario.nodes
    .filter((node) => houseCount(node) > 0)
    .map((node) => node.id)
    .sort((a, b) => (order.nodes[a] ?? Infinity) - (order.nodes[b] ?? Infinity));
  const delays: Record<string, number> = {};
  ids.forEach((id, index) => {
    delays[id] = LIGHT_START + (LIGHT_SECONDS * index) / Math.max(1, ids.length - 1);
  });
  return delays;
}

const ClusterHouses = memo(function ClusterHouses({ cluster }: { cluster: TownCluster }) {
  return (
    <>
      <path
        className="town__shadow town__shadow--houses"
        d={cluster.houses.map((house) => shadowPath(house)).join('')}
      />
      {cluster.houses.map((house, index) => (
        <House key={index} house={house} />
      ))}
    </>
  );
});

interface TownNetworkProps {
  town: Town;
  scenario: Scenario;
  diameters: Diameters;
  evaluation: StageEvaluation | null;
  pipeStatus: Record<string, LimitStatus>;
  service: Record<string, ServiceStatus>;
  selection: Selection;
  stale: boolean;
  /** Screen px per metre. */
  scale: number;
  order: FillOrder;
  /** True while the success sequence plays. */
  celebrating: boolean;
  /** Smallest size on screen (px) of the invisible hit areas: 44 for a finger. */
  hitTarget?: number;
}

/**
 * Interactive layer of the town in plan coordinates: one group per pipe (its street), node
 * (its houses), reservoir and pump. Pan does not re-render it; the parent moves the group.
 */
export const TownNetwork = memo(function TownNetwork({
  town,
  scenario,
  diameters,
  evaluation,
  pipeStatus,
  service,
  selection,
  stale,
  scale,
  order,
  celebrating,
  hitTarget = MOUSE_TARGET,
}: TownNetworkProps) {
  const tr = useTr();
  const num = useNum();
  const result = evaluation?.result;
  const px = 1 / scale;
  const isSelected = (type: NonNullable<Selection>['type'], id: string) =>
    selection?.type === type && selection.id === id;
  const position = new Map(
    [...scenario.nodes, ...scenario.reservoirs].map((n) => [n.id, { x: n.x, y: n.y }]),
  );
  const streets = new Map(town.streets.map((street) => [street.id, street]));
  const clusters = new Map(town.clusters.map((cluster) => [cluster.nodeId, cluster]));
  const delays = lightDelays(scenario, order);
  const span = Math.max(order.longest, 1);
  const interactive = (type: NonNullable<Selection>['type'], id: string, label: string) => ({
    'data-element': type,
    'data-id': id,
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    'aria-pressed': isSelected(type, id),
  });

  return (
    <g className="town__network">
      <g className="town__hull-hits">
        {town.clusters.map((cluster) => (
          <polygon
            key={cluster.nodeId}
            data-node-hit={cluster.nodeId}
            points={cluster.hull.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}
      </g>

      {scenario.pipes.map((pipe) => {
        const street = streets.get(pipe.id);
        if (!street) return null;
        const { a, b } = street;
        const dn = diameters[pipe.id] ?? pipe.initialDN;
        const width = pipeWidth(dn, scale) * px;
        const pipeResult = result?.pipes[pipe.id];
        const status = pipeStatus[pipe.id] ?? 'none';
        const flow = pipeResult?.flow ?? 0;
        const flowing = Math.abs(flow) > NO_FLOW;
        const reverse = flow < 0;
        const up = reverse ? b : a;
        const down = reverse ? a : b;
        const speed = Math.abs(pipeResult?.velocity ?? 0);
        const selected = isSelected('pipe', pipe.id);
        const fill = order.links[pipe.id];
        const first = fill?.first === pipe.to ? b : a;
        const last = fill?.first === pipe.to ? a : b;
        const className = [
          'town__pipe',
          `netview__pipe--${status}`,
          selected && 'town__el--selected',
        ]
          .filter(Boolean)
          .join(' ');
        const line = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        return (
          <g
            key={pipe.id}
            className={className}
            {...interactive(
              'pipe',
              pipe.id,
              describePipe({ tr, num }, pipe, dn, pipeResult, status, stale),
            )}
            data-status={status}
            data-direction={flowing ? (reverse ? 'reverse' : 'forward') : 'none'}
          >
            <line
              className="town__hit"
              {...line}
              strokeWidth={Math.max(street.width + 4, hitTarget * px)}
            />
            <line className="town__glow" {...line} strokeWidth={street.width + 3} />
            <line className="town__pipe-casing" {...line} strokeWidth={width + 2.5 * px} />
            <line className="town__pipe-line" {...line} strokeWidth={width} />
            {flowing && (
              <line
                className="town__flow"
                x1={up.x}
                y1={up.y}
                x2={down.x}
                y2={down.y}
                strokeWidth={Math.max(1.2 * px, width * 0.35)}
                strokeDasharray={`${4 * px} ${(DASH_PERIOD - 4) * px}`}
                style={
                  {
                    '--town-dash': DASH_PERIOD * px,
                    animationDuration: `${(DASH_PERIOD / Math.min(70, 14 + 18 * speed)).toFixed(3)}s`,
                  } as CSSProperties
                }
              />
            )}
            {celebrating && fill && Number.isFinite(fill.start) && (
              <path
                className="town__fill"
                d={`M${first.x} ${first.y}L${last.x} ${last.y}`}
                pathLength={1}
                strokeWidth={width + 3 * px}
                style={
                  {
                    '--town-fill-delay': `${((FILL_SECONDS * fill.start) / span).toFixed(3)}s`,
                    '--town-fill-time': `${Math.max(0.12, (FILL_SECONDS * (fill.end - fill.start)) / span).toFixed(3)}s`,
                  } as CSSProperties
                }
              />
            )}
          </g>
        );
      })}

      {scenario.pumps.map((pump) => {
        const house = town.pumps.find((p) => p.id === pump.id);
        const a = position.get(pump.from);
        const b = position.get(pump.to);
        if (!house || !a || !b) return null;
        const selected = isSelected('pump', pump.id);
        const line = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        return (
          <g
            key={pump.id}
            className={selected ? 'town__pump town__el--selected' : 'town__pump'}
            {...interactive(
              'pump',
              pump.id,
              `${describePump({ tr, num }, pump, result?.pumps[pump.id], stale)}, ${tr(text.pumpHouse)}`,
            )}
          >
            <line className="town__hit" {...line} strokeWidth={Math.max(26, hitTarget * px)} />
            <circle
              className="town__hit"
              cx={house.x}
              cy={house.y}
              r={Math.max(house.w / 2, (hitTarget / 2) * px)}
            />
            <line className="town__pump-line" {...line} strokeWidth={3 * px} />
            <circle className="town__ring" cx={house.x} cy={house.y} r={house.w / 2 + 10} />
            <PumpSprite pump={house} />
          </g>
        );
      })}

      {scenario.nodes.map((node) => {
        const cluster = clusters.get(node.id);
        const status = service[node.id] ?? 'unknown';
        const selected = isSelected('node', node.id);
        const nodeResult = result?.nodes[node.id];
        const houses = houseCount(node);
        const label = [
          tr(networkStrings.node(node.id)),
          tr(text.houses(houses)),
          houses > 0 && `${tr(networkStrings.demand)} ${num(node.demandLps)} L/s`,
          nodeResult &&
            `${tr(networkStrings.pressure)} ${num(nodeResult.pressure, 1)} ${HEAD_UNIT}`,
          houses > 0 ? tr(serviceLabels[status]) : nodeResult && tr(pressureStatusLabels.none),
          nodeResult && stale && tr(networkStrings.outdated),
        ]
          .filter(Boolean)
          .join(', ');
        const className = [
          'town__cluster',
          !cluster && 'town__cluster--bare',
          selected && 'town__el--selected',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g
            key={node.id}
            className={className}
            {...interactive('node', node.id, label)}
            data-status={status}
            style={{ '--town-delay': `${(delays[node.id] ?? 0).toFixed(3)}s` } as CSSProperties}
          >
            {cluster ? (
              <>
                <polygon
                  className="town__hull"
                  points={cluster.hull.map((p) => `${p.x},${p.y}`).join(' ')}
                />
                <ClusterHouses cluster={cluster} />
              </>
            ) : (
              <circle className="town__ring" cx={node.x} cy={node.y} r={30} />
            )}
            <circle
              className="town__plaza-hit"
              cx={node.x}
              cy={node.y}
              r={Math.max(23, (hitTarget / 2) * px)}
            />
            <circle
              className="town__node-dot"
              cx={node.x}
              cy={node.y}
              r={5.5 * px}
              strokeWidth={2 * px}
            />
          </g>
        );
      })}

      {scenario.reservoirs.map((reservoir) => {
        const site = town.reservoirs.find((r) => r.id === reservoir.id);
        if (!site) return null;
        const selected = isSelected('reservoir', reservoir.id);
        return (
          <g
            key={reservoir.id}
            className={selected ? 'town__reservoir town__el--selected' : 'town__reservoir'}
            {...interactive(
              'reservoir',
              reservoir.id,
              `${describeReservoir({ tr, num }, reservoir)}, ${tr(text[site.kind])}`,
            )}
            data-kind={site.kind}
          >
            <circle
              className="town__hit"
              cx={site.x}
              cy={site.y}
              r={Math.max(site.radius, (hitTarget / 2) * px)}
            />
            <circle className="town__ring" cx={site.x} cy={site.y} r={site.radius + 5} />
            <ReservoirSprite reservoir={site} />
          </g>
        );
      })}
    </g>
  );
});
