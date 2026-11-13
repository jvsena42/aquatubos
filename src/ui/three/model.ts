import type { StageEvaluation } from '../../game/types';
import type { Diameters, Scenario } from '../../scenarios/types';
import {
  DETAIL,
  gridIndices,
  gridLineIndices,
  gridPositions,
  groundPoints,
  headPoints,
  interpolateGrid,
  pipePath,
  pipeRadius,
  sceneLayout,
  segmentTransform,
  toWorld,
  type Detail,
  type Layout,
  type Quality,
  type SegmentTransform,
  type Vec3,
} from './geometry';
import { pressureStatus, velocityStatus, type Status } from './status';

/** Everything the scene draws, in world coordinates. Plain data built from the store. */

export interface SurfaceModel {
  positions: Float32Array;
  indices: Uint32Array;
  lineIndices: Uint32Array;
}

export interface PipeModel {
  id: string;
  dn: number;
  radius: number;
  path: Vec3[];
  status: Status;
}

export interface NodeModel {
  id: string;
  /** Centre of the sphere, slightly above the ground point. */
  position: Vec3;
  ground: Vec3;
  radius: number;
  status: Status;
  /** Pressure head, m, when there is a result. */
  pressure: number | null;
  /** Point of the hydraulic grade line above (or below) the node. */
  hgl: Vec3 | null;
}

export interface ReservoirModel {
  id: string;
  /** Ground position. */
  position: Vec3;
  radius: number;
  /** World Y of the tank bottom, the water surface and the tank rim. */
  bottomY: number;
  waterY: number;
  topY: number;
  waterLevel: number;
}

export interface PumpModel {
  id: string;
  path: Vec3[];
  radius: number;
  /** Marker at the middle of the link, pointing from suction to discharge. */
  marker: SegmentTransform;
}

export interface SceneModel {
  layout: Layout;
  exaggeration: number;
  /** Segment counts the scene builds its meshes with. */
  detail: Detail;
  terrain: SurfaceModel;
  hgl: SurfaceModel | null;
  pipes: PipeModel[];
  nodes: NodeModel[];
  reservoirs: ReservoirModel[];
  pumps: PumpModel[];
  /** Box that contains the scene, used to frame the camera. */
  bounds: { center: Vec3; halfSize: Vec3 };
}

export function buildSceneModel(
  scenario: Scenario,
  diameters: Diameters,
  evaluation: StageEvaluation | null,
  exaggeration: number,
  quality: Quality = 'high',
): SceneModel {
  const detail = DETAIL[quality];
  const layout = sceneLayout(scenario);
  const { extent } = layout;
  const relief = layout.topElevation - layout.baseElevation;

  const terrainGrid = interpolateGrid(layout, groundPoints(scenario), detail.gridCells);
  const nx = terrainGrid.xs.length;
  const ny = terrainGrid.ys.length;
  const indices = gridIndices(nx, ny);
  const lineIndices = gridLineIndices(nx, ny, detail.lineStep);
  const terrain: SurfaceModel = {
    positions: gridPositions(layout, terrainGrid, exaggeration),
    indices,
    lineIndices,
  };

  // An undersized design can put the HGL hundreds of metres under the ground. It is drawn no
  // lower than this elevation, which is already hidden by the terrain.
  const floorElevation = layout.baseElevation - Math.max(relief, 10) * 0.5;
  const heads = evaluation ? headPoints(scenario, evaluation.result) : null;
  const hgl: SurfaceModel | null = heads
    ? {
        positions: gridPositions(
          layout,
          interpolateGrid(layout, heads, detail.gridCells),
          exaggeration,
          floorElevation,
        ),
        indices,
        lineIndices,
      }
    : null;

  const pipes: PipeModel[] = [];
  for (const pipe of scenario.pipes) {
    const dn = diameters[pipe.id] ?? pipe.initialDN;
    const radius = pipeRadius(dn, extent);
    const path = pipePath(scenario, layout, pipe, exaggeration, radius, detail.pathSegments);
    if (path)
      pipes.push({ id: pipe.id, dn, radius, path, status: velocityStatus(evaluation, pipe.id) });
  }

  const maxPipeRadius = Math.max(0, ...pipes.map((p) => p.radius));
  const nodeRadius = Math.max(extent * 0.011, maxPipeRadius * 1.15);
  const nodes: NodeModel[] = scenario.nodes.map((node) => {
    const ground = toWorld(layout, node.x, node.y, node.elevation, exaggeration);
    const result = heads ? evaluation?.result.nodes[node.id] : undefined;
    return {
      id: node.id,
      position: { ...ground, y: ground.y + nodeRadius * 0.5 },
      ground,
      radius: nodeRadius,
      status: pressureStatus(evaluation, node.id),
      pressure: result ? result.pressure : null,
      hgl: result
        ? toWorld(layout, node.x, node.y, Math.max(result.head, floorElevation), exaggeration)
        : null,
    };
  });

  const tankHeight = extent * 0.07;
  const reservoirs: ReservoirModel[] = scenario.reservoirs.map((reservoir) => {
    const position = toWorld(layout, reservoir.x, reservoir.y, reservoir.elevation, exaggeration);
    const waterY = (reservoir.waterLevel - layout.baseElevation) * exaggeration;
    return {
      id: reservoir.id,
      position,
      radius: extent * 0.045,
      bottomY: waterY - tankHeight,
      waterY,
      topY: waterY + tankHeight * 0.3,
      waterLevel: reservoir.waterLevel,
    };
  });

  const pumps: PumpModel[] = [];
  for (const pump of scenario.pumps) {
    const radius = extent * 0.006;
    const path = pipePath(scenario, layout, pump, exaggeration, radius, detail.pathSegments);
    // The marker sits on the middle point and follows the pieces on either side of it.
    const middle = detail.pathSegments / 2;
    const before = path?.[middle - 1];
    const after = path?.[middle + 1];
    if (path && before && after) {
      pumps.push({ id: pump.id, path, radius, marker: segmentTransform(before, after) });
    }
  }

  const height = Math.max(relief * exaggeration + tankHeight * 0.3, 1);
  const halfX = (layout.maxX - layout.minX) / 2;
  const halfZ = (layout.maxY - layout.minY) / 2;
  return {
    layout,
    exaggeration,
    detail,
    terrain,
    hgl,
    pipes,
    nodes,
    reservoirs,
    pumps,
    bounds: {
      center: { x: 0, y: height / 2, z: 0 },
      halfSize: { x: halfX, y: height / 2, z: halfZ },
    },
  };
}
