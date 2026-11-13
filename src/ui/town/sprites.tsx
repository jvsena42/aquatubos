import { memo } from 'react';
import { boxCorners, type Box } from '../../game/town/geometry';
import type { TownBuilding, TownHouse, TownPump, TownReservoir, TownTree } from '../../game/town';
import type { ServiceStatus } from '../../game/houses';

/** Ground shadow offset, m: the light comes from the top left. */
export const SHADOW = { x: 3.5, y: 4.5 } as const;

const r1 = (value: number) => Math.round(value * 10) / 10;
const deg = (radians: number) => r1((radians * 180) / Math.PI);

export function boxTransform(box: Box): string {
  return `translate(${r1(box.x)} ${r1(box.y)}) rotate(${deg(box.rotation)})`;
}

/** Outline of a box moved by the shadow offset times `height`, as path data. */
export function shadowPath(box: Box, height = 1): string {
  return (
    boxCorners(box)
      .map(
        (p, index) =>
          `${index === 0 ? 'M' : 'L'}${r1(p.x + SHADOW.x * height)} ${r1(p.y + SHADOW.y * height)}`,
      )
      .join('') + 'Z'
  );
}

export function circlePath(x: number, y: number, r: number): string {
  return `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;
}

/**
 * Hip roof seen from above, in the local frame of the box: the two planes that face away from
 * the light as one path, the ridge and hips as another, and the long plane that is lit (where
 * the windows go).
 */
export function hipRoof(w: number, d: number, rotation: number) {
  const hw = w / 2;
  const hd = d / 2;
  const ridge = Math.max(0, hw - hd);
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  const planes = [
    { dark: sin - cos > 1e-6, d: `M${-hw} ${-hd}H${hw}L${ridge} 0H${-ridge}Z` },
    { dark: cos + sin > 1e-6, d: `M${hw} ${-hd}V${hd}L${ridge} 0Z` },
    { dark: cos - sin > 1e-6, d: `M${hw} ${hd}H${-hw}L${-ridge} 0H${ridge}Z` },
    { dark: -cos - sin > 1e-6, d: `M${-hw} ${hd}V${-hd}L${-ridge} 0Z` },
  ];
  return {
    shade: planes
      .filter((plane) => plane.dark)
      .map((plane) => plane.d)
      .join(''),
    lines: `M${-hw} ${-hd}L${-ridge} 0H${ridge}L${hw} ${-hd}M${-hw} ${hd}L${-ridge} 0M${ridge} 0L${hw} ${hd}`,
    litSide: planes[0]!.dark ? 1 : -1,
  };
}

/** One house of a demand node: hip roof in two tones and two roof windows. */
export const House = memo(function House({ house }: { house: TownHouse }) {
  const w = r1(house.w);
  const d = r1(house.d);
  const roof = hipRoof(w, d, house.rotation);
  const wy = roof.litSide * d * 0.27;
  const window = (x: number) => `M${r1(x - 2.6)} ${r1(wy - 2)}h5.2v4h-5.2Z`;
  return (
    <g
      className={house.roof === 1 ? 'town__house town__house--alt' : 'town__house'}
      transform={boxTransform(house)}
    >
      <rect className="town__roof" x={-w / 2} y={-d / 2} width={w} height={d} rx={1.5} />
      <path className="town__roof-shade" d={roof.shade} />
      <path className="town__roof-lines" d={roof.lines} />
      <path className="town__window" d={window(-w * 0.17) + window(w * 0.17)} />
    </g>
  );
});

/** Scenery building: flat roof with a parapet line, or the shape of its landmark type. */
export function Building({ building }: { building: TownBuilding }) {
  const w = r1(building.w);
  const d = r1(building.d);
  const transform = boxTransform(building);
  const body = (className: string, rx = 1.5) => (
    <rect className={className} x={-w / 2} y={-d / 2} width={w} height={d} rx={rx} />
  );
  switch (building.kind) {
    case 'house': {
      const roof = hipRoof(w, d, building.rotation);
      return (
        <g className="town__house town__house--extra" transform={transform}>
          {body('town__roof')}
          <path className="town__roof-shade" d={roof.shade} />
          <path className="town__roof-lines" d={roof.lines} />
        </g>
      );
    }
    case 'square':
      return (
        <g className="town__landmark" transform={transform}>
          {body('town__paving', 8)}
          <circle className="town__paving-ring" r={r1(Math.min(w, d) * 0.3)} />
          <circle className="town__pond" r={r1(Math.min(w, d) * 0.13)} />
        </g>
      );
    case 'church':
      return (
        <g className="town__landmark" transform={transform}>
          <path
            className="town__civic"
            d={`M${-w * 0.22} ${-d / 2}H${w * 0.22}V${-d * 0.18}H${w / 2}V${d * 0.12}H${w * 0.22}V${d / 2}H${-w * 0.22}V${d * 0.12}H${-w / 2}V${-d * 0.18}H${-w * 0.22}Z`}
          />
          <path
            className="town__roof-lines"
            d={`M0 ${-d / 2}V${d / 2}M${-w / 2} ${-d * 0.03}H${w / 2}`}
          />
          <circle className="town__civic-mark" cy={r1(-d * 0.03)} r={4} />
        </g>
      );
    case 'school':
      return (
        <g className="town__landmark" transform={transform}>
          <path
            className="town__civic"
            d={`M${-w / 2} ${-d / 2}H${w / 2}V${d / 2}H${w * 0.24}V${-d * 0.08}H${-w * 0.24}V${d / 2}H${-w / 2}Z`}
          />
          <path
            className="town__roof-lines"
            d={`M${-w * 0.37} ${-d / 2 + 5}V${d / 2 - 5}M${w * 0.37} ${-d / 2 + 5}V${d / 2 - 5}M${-w * 0.3} ${-d * 0.29}H${w * 0.3}`}
          />
          <circle className="town__civic-mark" cy={r1(d * 0.24)} r={4} />
        </g>
      );
    case 'market': {
      const stripes = [-0.3, -0.1, 0.1, 0.3]
        .map((t) => `M${r1(w * t)} ${-d / 2}V${d / 2}`)
        .join('');
      return (
        <g className="town__landmark" transform={transform}>
          {body('town__civic')}
          <path className="town__awning" d={stripes} style={{ strokeWidth: r1(w * 0.1) }} />
        </g>
      );
    }
    default:
      return (
        <g
          className={
            building.variant === 1 ? 'town__building town__building--alt' : 'town__building'
          }
          transform={transform}
        >
          {body('town__building-body')}
          <rect
            className="town__building-roof"
            x={-w / 2 + 4}
            y={-d / 2 + 4}
            width={r1(w - 8)}
            height={r1(d - 8)}
            rx={1}
          />
        </g>
      );
  }
}

export function Tree({ tree }: { tree: TownTree }) {
  return (
    <circle
      className={tree.variant === 1 ? 'town__tree town__tree--alt' : 'town__tree'}
      cx={tree.x}
      cy={tree.y}
      r={tree.radius}
    />
  );
}

/** Reservoir seen from above: a round elevated tank with a long shadow, or a walled basin. */
export function ReservoirSprite({ reservoir }: { reservoir: TownReservoir }) {
  if (reservoir.kind === 'elevated') {
    return (
      <g transform={`translate(${reservoir.x} ${reservoir.y})`}>
        <circle className="town__shadow" cx={SHADOW.x * 3.4} cy={SHADOW.y * 3.4} r={26} />
        <path
          className="town__tower-legs"
          d={`M-17 -17L${-17 + SHADOW.x * 2.6} ${-17 + SHADOW.y * 2.6}M17 17L${17 + SHADOW.x * 2.6} ${17 + SHADOW.y * 2.6}M-17 17L${-17 + SHADOW.x * 2.6} ${17 + SHADOW.y * 2.6}M17 -17L${17 + SHADOW.x * 2.6} ${-17 + SHADOW.y * 2.6}`}
        />
        <circle className="town__tank" r={27} />
        <circle className="town__tank-water" r={18} />
        <circle className="town__tank-cap" r={4} />
      </g>
    );
  }
  return (
    <g transform={`translate(${reservoir.x} ${reservoir.y})`}>
      <rect
        className="town__shadow"
        x={-29 + SHADOW.x}
        y={-29 + SHADOW.y}
        width={58}
        height={58}
        rx={7}
      />
      <rect className="town__tank" x={-29} y={-29} width={58} height={58} rx={7} />
      <rect className="town__tank-water" x={-21} y={-21} width={42} height={42} rx={3} />
      <path className="town__tank-waves" d="M-13 -6q6.5 -6 13 0t13 0M-13 8q6.5 -6 13 0t13 0" />
    </g>
  );
}

/** Pump house: a small flat-roofed building with the pump symbol of the schematic on it. */
export function PumpSprite({ pump }: { pump: TownPump }) {
  const { w, d } = pump;
  return (
    <>
      <path className="town__shadow" d={shadowPath(pump)} />
      <g transform={boxTransform(pump)}>
        <rect className="town__tank" x={-w / 2} y={-d / 2} width={w} height={d} rx={3} />
        <circle className="town__pump-body" r={10.5} />
        <path className="town__pump-mark" d="M-4.5 -5.5L6 0L-4.5 5.5Z" />
      </g>
    </>
  );
}

/**
 * Status mark of a cluster in a 20 px box centred at the origin. Shape and glyph differ per
 * status, so it does not depend on colour: a disc with a drop (served), a rounded square with
 * a crossed tap (dry taps), a diamond with a burst pipe (static pressure too high).
 */
export function StatusBadge({ status }: { status: Exclude<ServiceStatus, 'unknown'> }) {
  if (status === 'ok') {
    return (
      <g className="town__badge town__badge--ok">
        <circle className="town__badge-shape" r={8.5} />
        <path
          className="town__badge-fill"
          d="M0 -5.2C2.6 -2 4 0 4 1.8A4 4 0 0 1 -4 1.8C-4 0 -2.6 -2 0 -5.2Z"
        />
      </g>
    );
  }
  if (status === 'low') {
    return (
      <g className="town__badge town__badge--low">
        <rect className="town__badge-shape" x={-8.5} y={-8.5} width={17} height={17} rx={4} />
        <path
          className="town__badge-stroke"
          d="M-5 -0.5H1A2.6 2.6 0 0 1 3.6 2.1V4M-2 -0.5V-3.6M-4.2 -3.8H0.2"
        />
        <path className="town__badge-slash" d="M-5 5.2L5.2 -5" />
      </g>
    );
  }
  return (
    <g className="town__badge town__badge--high">
      <path className="town__badge-shape" d="M0 -10.5L10.5 0L0 10.5L-10.5 0Z" />
      <path
        className="town__badge-stroke town__badge-stroke--heavy"
        d="M-5.5 2.6H-1.8M1.8 2.6H5.5"
      />
      <path className="town__badge-stroke" d="M0 1.4V-5M-2.2 0.2L-4 -2.8M2.2 0.2L4 -2.8" />
    </g>
  );
}
