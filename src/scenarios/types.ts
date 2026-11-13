import type { CheckSettings, HeadLossFormula, LocalizedText, Loop } from '../engine/types';

/**
 * Scenario (stage) file format. Scenario files use display units because they are meant to be
 * read and edited by people: L/s for demand and pump flow, mm for diameters, m for the rest.
 * `game/buildNetwork.ts` converts a scenario to an SI `Network`.
 */

export interface ScenarioNode {
  id: string;
  /** Plan coordinates, m. */
  x: number;
  y: number;
  /** Ground elevation, m. */
  elevation: number;
  /** Demand, L/s. */
  demandLps: number;
}

export interface ScenarioReservoir {
  id: string;
  x: number;
  y: number;
  /** Ground elevation at the reservoir, m (only used for drawing). */
  elevation: number;
  /** Water surface level = total head, m. */
  waterLevel: number;
  /**
   * How the town view draws it. Default: `elevated` (water tower) when the water level is more
   * than 8 m above the ground, otherwise `ground`.
   */
  kind?: 'elevated' | 'ground';
}

export interface ScenarioPipe {
  id: string;
  from: string;
  to: string;
  /** m */
  length: number;
  /** Nominal diameter the stage starts with, mm. Must be in the commercial catalog. */
  initialDN: number;
  /** When true the player cannot change the diameter. */
  fixed?: boolean;
}

export interface ScenarioPump {
  id: string;
  from: string;
  to: string;
  /** Three points of the pump curve: shutoff, design and maximum flow. */
  points: [ScenarioPumpPoint, ScenarioPumpPoint, ScenarioPumpPoint];
}

export interface ScenarioPumpPoint {
  flowLps: number;
  /** m */
  head: number;
}

export interface ScenarioFeatures {
  /** HGL profile view. */
  hglProfile: boolean;
  /** Hardy Cross iteration table. */
  hardyCross: boolean;
  /** Cost and budget scoring. */
  cost: boolean;
  /** Pump curve vs system curve chart. */
  pumpChart: boolean;
}

export interface ScenarioReference {
  /** A known solution that passes every check: DN in mm by pipe id. */
  diameters: Record<string, number>;
  /** Cost of the reference solution, R$. */
  cost: number;
  /** How the reference was obtained. */
  method: string;
}

export interface Scenario {
  id: string;
  /** 1-based position; stage n unlocks when stage n−1 is completed. */
  order: number;
  title: LocalizedText;
  summary: LocalizedText;
  /** Paragraphs shown when the stage opens. */
  briefing: LocalizedText[];
  objectives: LocalizedText[];
  formula: HeadLossFormula;
  /** Hazen-Williams coefficient C of the pipes. */
  hazenWilliamsC: number;
  /** Absolute roughness for Darcy-Weisbach, mm. */
  roughnessMm: number;
  nodes: ScenarioNode[];
  reservoirs: ScenarioReservoir[];
  pipes: ScenarioPipe[];
  pumps: ScenarioPump[];
  checks: CheckSettings;
  /** Maximum cost, R$, or null when the stage has no budget. */
  budget: number | null;
  features: ScenarioFeatures;
  /** Loops for Hardy Cross. When omitted they are detected automatically. */
  loops?: Loop[];
  /** Node ids from the source to the critical node, used by the HGL profile by default. */
  profilePath: string[];
  reference: ScenarioReference;
  /** Optional overrides for the generated town scenery. */
  town?: ScenarioTown;
}

export type TownLandmarkType = 'school' | 'church' | 'market' | 'square';

/**
 * Overrides for the town view. The scenery is generated from the network geometry, seeded by
 * the stage id, so every field is optional. Coordinates are plan coordinates in metres, in the
 * same system as the nodes.
 */
export interface ScenarioTown {
  /** Seed for the generator. Default: the stage id. */
  seed?: string;
  /** Centre and radius of the park. Default: the largest free block. */
  park?: { x: number; y: number; radius?: number };
  /** Buildings placed at fixed positions. */
  landmarks?: { type: TownLandmarkType; x: number; y: number }[];
  /** Extra scenery houses (not tied to a demand node). */
  extraHouses?: { x: number; y: number }[];
  /** False to draw the town without filler houses and trees. Default: true. */
  scenery?: boolean;
}

/** DN in mm by pipe id. */
export type Diameters = Record<string, number>;
