import { memo, type ReactNode } from 'react';
import { ROAD_DY, segment, type MapLayout } from './mapLayout';

function House({ x, y, alt = false }: { x: number; y: number; alt?: boolean }) {
  return (
    <>
      <rect className="m-body" x={x - 12} y={y - 16} width="24" height="16" />
      <path
        className={alt ? 'm-roof-alt' : 'm-roof'}
        d={`M${x - 15} ${y - 16}L${x} ${y - 29}L${x + 15} ${y - 16}Z`}
      />
      <rect className="m-window" x={x - 4} y={y - 11} width="8" height="6" />
    </>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path className="m-line" d={`M${x} ${y}v-8`} />
      <circle className="m-tree" cx={x} cy={y - 14} r="9" />
    </>
  );
}

/** One motif per stage, drawn around (0, 0) in a box of about 180 × 120. */
const MOTIFS: Record<number, ReactNode> = {
  // Water tower and a flat street.
  1: (
    <>
      <path className="m-line" d="M-70 28l4-40M-46 28l-4-40M-69 10h22" />
      <rect className="m-body" x="-75" y="-42" width="34" height="30" rx="4" />
      <path className="m-water" d="M-73-28h30v10a4 4 0 0 1-4 4h-22a4 4 0 0 1-4-4Z" />
      <House x={-14} y={28} />
      <House x={18} y={28} alt />
      <House x={50} y={28} />
      <Tree x={76} y={28} />
    </>
  ),
  // Hills with contour lines and houses at different heights.
  2: (
    <>
      <path className="m-hill" d="M-88 30Q-48-52-8 30Z" />
      <path className="m-contour" d="M-68 12Q-48-22-28 12M-58-2Q-48-16-38-2" />
      <path className="m-hill" d="M-14 30Q30-30 84 30Z" />
      <path className="m-contour" d="M8 16Q32-10 60 16" />
      <House x={-48} y={-6} />
      <House x={-8} y={30} alt />
      <House x={32} y={3} />
      <House x={68} y={30} alt />
    </>
  ),
  // A ring road.
  3: (
    <>
      <ellipse className="m-street-edge" cx="0" cy="8" rx="62" ry="38" />
      <ellipse className="m-street" cx="0" cy="8" rx="62" ry="38" />
      <House x={-52} y={-24} />
      <House x={52} y={-24} alt />
      <House x={-18} y={22} alt />
      <House x={18} y={22} />
      <Tree x={0} y={-36} />
    </>
  ),
  // A small grid of blocks.
  4: (
    <>
      <path className="m-street-edge" d="M-82-10h164M0-56v102M-56-56v102M56-56v102" />
      <path className="m-street" d="M-82-10h164M0-56v102M-56-56v102M56-56v102" />
      <House x={-28} y={-20} />
      <House x={28} y={-20} alt />
      <House x={-28} y={30} alt />
      <House x={28} y={30} />
      <Tree x={-74} y={-20} />
      <Tree x={74} y={30} />
    </>
  ),
  // A pump house and a rising main up the hill.
  5: (
    <>
      <path className="m-hill" d="M-14 30L86-34V30Z" />
      <path className="m-main m-main--wet" d="M-40 16H-8L60-28" />
      <rect className="m-body" x="-76" y="2" width="38" height="26" rx="2" />
      <path className="m-roof-alt" d="M-80 2h46v-7h-46Z" />
      <circle className="m-pump" cx="-57" cy="15" r="7" />
      <path className="m-line" d="M-60 11l7 4-7 4Z" />
      <House x={34} y={-2} />
      <House x={70} y={-25} alt />
      <Tree x={-18} y={28} />
    </>
  ),
};

interface SceneryProps {
  layout: MapLayout;
  /** Stage order of each site, in the same order as `layout.sites`. */
  orders: number[];
  /** Number of stages the player can open; the main is full of water up to the last of them. */
  unlockedCount: number;
}

/**
 * Static part of the map: the road with the water main and one neighbourhood per stage. Locked
 * neighbourhoods are greyed and the main beyond the last unlocked stage is dry.
 */
export const Scenery = memo(function Scenery({ layout, orders, unlockedCount }: SceneryProps) {
  const { sites } = layout;
  const segments = sites.slice(1).map((site, index) => segment(sites[index]!, site));
  const road = segments.join('');
  return (
    <>
      {sites.map((site, index) => (
        <ellipse key={index} className="m-grass" cx={site.x} cy={site.y + 4} rx="96" ry="60" />
      ))}
      <path className="m-street-edge m-street-edge--road" d={road} />
      <path className="m-street m-street--road" d={road} />
      {segments.map((d, index) => (
        <path
          key={index}
          className={index + 1 < unlockedCount ? 'm-main m-main--wet' : 'm-main m-main--dry'}
          d={d}
        />
      ))}
      {sites.map((site, index) => (
        <g
          key={index}
          className={index < unlockedCount ? 'm-site' : 'm-site m-site--locked'}
          transform={`translate(${site.x} ${site.y})`}
        >
          {MOTIFS[((orders[index]! - 1) % 5) + 1]}
          {/* Numbered waypoint on the main. */}
          <circle
            className={index < unlockedCount ? 'm-node m-node--wet' : 'm-node'}
            cx="0"
            cy={ROAD_DY}
            r="12"
          />
          <text className="m-number" x="0" y={ROAD_DY}>
            {orders[index]}
          </text>
        </g>
      ))}
    </>
  );
});
