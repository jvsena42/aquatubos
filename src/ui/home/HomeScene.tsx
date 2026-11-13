import { memo } from 'react';

/** Street level and depth of the water main, in scene units (viewBox 1200 × 380). */
const GROUND = 270;
const MAIN = 326;
const TOWER_X = 600;

interface HouseSpec {
  x: number;
  /** Two storeys. */
  tall?: boolean;
  alt?: boolean;
}

/** Houses from left to right; the water tower stands in the middle. */
const HOUSES: readonly HouseSpec[] = [
  { x: 78, alt: true },
  { x: 214, tall: true },
  { x: 348 },
  { x: 472, alt: true },
  { x: 728 },
  { x: 852, tall: true, alt: true },
  { x: 986 },
  { x: 1122, alt: true },
];

const TREES: readonly number[] = [146, 282, 412, 790, 920, 1054];

/** Windows light up one house after the other, starting next to the tower. */
const LIT_ORDER = [...HOUSES].sort(
  (a, b) => Math.abs(a.x - TOWER_X) - Math.abs(b.x - TOWER_X) || a.x - b.x,
);

function House({ x, tall = false, alt = false }: HouseSpec) {
  const height = tall ? 66 : 40;
  const top = GROUND - height;
  const delay = `${0.6 + 0.45 * LIT_ORDER.findIndex((house) => house.x === x)}s`;
  const windows = tall
    ? `M${x - 20} ${top + 10}h14v12h-14ZM${x + 6} ${top + 10}h14v12h-14ZM${x - 20} ${top + 38}h14v12h-14Z`
    : `M${x - 20} ${top + 10}h14v12h-14Z`;
  return (
    <>
      <rect className="hs-body" x={x - 28} y={top} width="56" height={height} />
      <path
        className={alt ? 'hs-roof hs-roof--alt' : 'hs-roof'}
        d={`M${x - 34} ${top}L${x} ${top - 26}L${x + 34} ${top}Z`}
      />
      <rect className="hs-door" x={x + 7} y={GROUND - 22} width="12" height="22" />
      <path className="hs-window" d={windows} />
      <path className="hs-lit" style={{ animationDelay: delay }} d={windows} />
    </>
  );
}

const SERVICES = HOUSES.map((house) => `M${house.x - 13} ${MAIN}V${GROUND - 6}`).join('');
const RISER = `M${TOWER_X} 196V${MAIN}`;
const MAINS = `M${TOWER_X} ${MAIN}H0M${TOWER_X} ${MAIN}H1200`;
const NETWORK = RISER + MAINS + SERVICES;

/**
 * Decorative scene of the title screen: a street seen from the side, with the water tower in
 * the middle and the mains under the pavement. Water runs away from the tower and the windows
 * light up; all motion is CSS and stops under prefers-reduced-motion.
 */
export const HomeScene = memo(function HomeScene() {
  return (
    <svg
      className="home-scene"
      viewBox="0 0 1200 380"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="hs-cloud"
        d="M258 172h96a15 15 0 0 0 0-30h-6a24 24 0 0 0-45-8a18 18 0 0 0-33 10h-12a14 14 0 0 0 0 28Z"
      />
      <path
        className="hs-cloud hs-cloud--slow"
        d="M908 160h84a13 13 0 0 0 0-26h-5a21 21 0 0 0-40-7a16 16 0 0 0-29 9h-10a12 12 0 0 0 0 24Z"
      />

      <path className="hs-hill" d="M0 228Q150 176 330 270H0Z" />
      <path className="hs-hill" d="M800 270Q1010 170 1200 222V270Z" />

      <rect className="hs-soil" x="0" y={GROUND} width="1200" height={380 - GROUND} />
      <path
        className="hs-strata"
        d="M30 356h64M196 368h96M420 358h52M668 366h84M884 356h60M1070 370h92M300 300h40M930 298h48"
      />
      <g className="hs-pebble">
        <ellipse cx="136" cy="348" rx="9" ry="5" />
        <ellipse cx="542" cy="362" rx="11" ry="6" />
        <ellipse cx="792" cy="350" rx="8" ry="5" />
        <ellipse cx="1016" cy="354" rx="10" ry="6" />
        <ellipse cx="398" cy="300" rx="6" ry="4" />
      </g>
      <rect className="hs-street" x="-4" y={GROUND} width="1208" height="9" />

      {/* Pipes: casing, water and the moving dashes. Every path starts at the tower side. */}
      <path className="hs-pipe" d={NETWORK} />
      <path className="hs-water" d={NETWORK} />
      <path className="hs-flow" d={RISER} />
      <path className="hs-flow" d={MAINS} />
      <path className="hs-flow hs-flow--service" d={SERVICES} />
      <g className="hs-node">
        <circle cx={TOWER_X} cy={MAIN} r="8" />
        {HOUSES.map((house) => (
          <circle key={house.x} cx={house.x - 13} cy={MAIN} r="6" />
        ))}
      </g>

      {TREES.map((x, index) => (
        <g key={x}>
          <path className="hs-line" d={`M${x} ${GROUND}v-${index % 2 ? 20 : 14}`} />
          <circle className="hs-tree" cx={x} cy={GROUND - (index % 2 ? 32 : 24)} r="14" />
        </g>
      ))}

      {/* Water tower */}
      <path
        className="hs-line"
        d={`M${TOWER_X - 26} ${GROUND}L${TOWER_X - 19} 196M${TOWER_X + 26} ${GROUND}L${TOWER_X + 19} 196M${TOWER_X - 24} 248H${TOWER_X + 24}M${TOWER_X - 21} 222H${TOWER_X + 21}`}
      />
      <rect className="hs-body" x={TOWER_X - 42} y="140" width="84" height="56" rx="7" />
      <path className="hs-tank" d={`M${TOWER_X - 40} 166h80v21a7 7 0 0 1-7 7h-66a7 7 0 0 1-7-7Z`} />
      <path
        className="hs-roof hs-roof--alt"
        d={`M${TOWER_X - 50} 140L${TOWER_X} 118L${TOWER_X + 50} 140Z`}
      />

      {HOUSES.map((house) => (
        <House key={house.x} {...house} />
      ))}
    </svg>
  );
});
