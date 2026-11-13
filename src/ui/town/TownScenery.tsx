import { memo } from 'react';
import type { Town } from '../../game/town';
import { SMALL_TREE_RADIUS } from './detail';
import { Building, circlePath, SHADOW, shadowPath, Tree } from './sprites';

const r1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Static part of the town: hill shading, park, streets, filler buildings and trees. It depends
 * only on the generated town, so selection and results never re-render it.
 */
export const TownScenery = memo(function TownScenery({ town }: { town: Town }) {
  const { park } = town;
  const shadows =
    town.buildings
      .filter((building) => building.kind !== 'square')
      .map((building) => shadowPath(building, building.kind === 'block' ? 1.3 : 1))
      .join('') +
    town.trees
      .map((tree) => circlePath(tree.x + SHADOW.x, tree.y + SHADOW.y, tree.radius))
      .join('');
  const highlights = town.trees
    .map((tree) =>
      circlePath(tree.x - tree.radius * 0.24, tree.y - tree.radius * 0.26, tree.radius * 0.5),
    )
    .join('');
  const side = park ? park.radius * 1.7 : 0;

  return (
    <g className="town__scenery" aria-hidden="true">
      {town.terrain?.bands.map((band, index) => (
        <path
          key={band.level}
          className={`town__band town__band--${Math.min(6, index + 1)}`}
          d={band.polygons
            .map((polygon) => 'M' + polygon.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L') + 'Z')
            .join('')}
        />
      ))}

      {park && (
        <g className="town__park" transform={`translate(${park.x} ${park.y})`}>
          <rect
            className="town__grass"
            x={-side / 2}
            y={-side / 2}
            width={side}
            height={side}
            rx={r1(park.radius * 0.5)}
          />
          <path
            className="town__path"
            d={`M${r1(-side / 2)} 0H${r1(side / 2)}M0 ${r1(-side / 2)}V${r1(side / 2)}`}
          />
          <circle className="town__paving" r={r1(park.radius * 0.3)} />
          <circle className="town__pond" r={r1(park.radius * 0.18)} />
        </g>
      )}

      <g className="town__street-edges">
        {town.streets.map((street) => (
          <line
            key={street.id}
            x1={street.a.x}
            y1={street.a.y}
            x2={street.b.x}
            y2={street.b.y}
            strokeWidth={street.width + 3}
          />
        ))}
        {town.plazas.map((plaza) => (
          <circle key={plaza.nodeId} cx={plaza.x} cy={plaza.y} r={plaza.radius + 1.5} />
        ))}
        {town.reservoirs.map((site) => (
          <circle key={site.id} cx={site.x} cy={site.y} r={site.radius + 1.5} />
        ))}
      </g>
      <g className="town__street-fills">
        {town.streets.map((street) => (
          <line
            key={street.id}
            x1={street.a.x}
            y1={street.a.y}
            x2={street.b.x}
            y2={street.b.y}
            strokeWidth={street.width}
          />
        ))}
        {town.plazas.map((plaza) => (
          <circle key={plaza.nodeId} cx={plaza.x} cy={plaza.y} r={plaza.radius} />
        ))}
        {town.reservoirs.map((site) => (
          <circle key={site.id} cx={site.x} cy={site.y} r={site.radius} />
        ))}
      </g>

      <path className="town__shadow town__shadow--scenery" d={shadows} />
      {town.buildings.map((building, index) => (
        <Building key={index} building={building} />
      ))}
      {town.trees.map((tree, index) => (
        <Tree key={index} tree={tree} small={tree.radius < SMALL_TREE_RADIUS} />
      ))}
      <path className="town__tree-light" d={highlights} />
    </g>
  );
});
