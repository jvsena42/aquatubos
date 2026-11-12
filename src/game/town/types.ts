import type { TownLandmarkType } from '../../scenarios/types';
import type { Bounds, Box, Point } from './geometry';
import type { Terrain } from './terrain';

/** A street. Pipe streets carry the pipe along their centre line; a pump link gets a lane. */
export interface TownStreet {
  /** Id of the pipe or pump that runs under it. */
  id: string;
  kind: 'pipe' | 'pump';
  /** Node or reservoir ids at the two ends, in the direction of the link. */
  from: string;
  to: string;
  a: Point;
  b: Point;
  /** Full width, m. */
  width: number;
}

/** Round junction at a node, so the streets that meet there look joined. */
export interface TownPlaza extends Point {
  nodeId: string;
  radius: number;
}

export interface TownHouse extends Box {
  /** Demand node the house belongs to. */
  nodeId: string;
  /** Roof colour variant. */
  roof: 0 | 1;
}

/** The houses of one demand node. */
export interface TownCluster extends Point {
  nodeId: string;
  houses: TownHouse[];
  /** Convex outline around the houses and the node plaza. */
  hull: Point[];
}

export type TownBuildingKind = 'house' | 'shed' | 'block' | TownLandmarkType;

/** Scenery building: not tied to a node. `house` comes from `town.extraHouses`. */
export interface TownBuilding extends Box {
  kind: TownBuildingKind;
  /** Colour variant. */
  variant: 0 | 1;
}

export interface TownTree extends Point {
  radius: number;
  variant: 0 | 1;
  /** True for the trees planted inside the park. */
  inPark: boolean;
}

export interface TownPark extends Point {
  radius: number;
}

export interface TownReservoir extends Point {
  id: string;
  kind: 'elevated' | 'ground';
  /** Radius of the site kept free of scenery, m. */
  radius: number;
}

/** Pump house, centred on the pump link and turned along it (`rotation` points downstream). */
export interface TownPump extends Box {
  id: string;
}

/** Everything the town view draws, in plan coordinates (m, same system as the nodes). */
export interface Town {
  seed: string;
  /** Box around every item. */
  bounds: Bounds;
  /** Box around the network, its houses and sites: what the view fits on screen. */
  focus: Bounds;
  streets: TownStreet[];
  plazas: TownPlaza[];
  clusters: TownCluster[];
  buildings: TownBuilding[];
  trees: TownTree[];
  park: TownPark | null;
  reservoirs: TownReservoir[];
  pumps: TownPump[];
  /** Null on flat stages. */
  terrain: Terrain | null;
}
