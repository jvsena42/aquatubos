/**
 * Shared types of the hydraulic engine.
 *
 * Every quantity in the engine is in SI units:
 *   length, diameter, elevation, head, pressure head: m
 *   flow: m³/s        velocity: m/s
 * Conversion to display units (L/s, mm, mca) happens only in `units.ts` and the UI.
 */

export type HeadLossFormula = 'hazen-williams' | 'darcy-weisbach';

export interface LocalizedText {
  pt: string;
  en: string;
}

/** Node with unknown head and a known demand (outflow). */
export interface Junction {
  id: string;
  /** Ground elevation, m. */
  elevation: number;
  /** Demand leaving the network at this node, m³/s (>= 0 for consumption). */
  demand: number;
}

/** Node with fixed total head (water surface level). */
export interface Reservoir {
  id: string;
  /** Total head = water surface elevation, m. */
  head: number;
}

export interface Pipe {
  id: string;
  /** Start node id. Positive flow runs from `from` to `to`. */
  from: string;
  to: string;
  /** m */
  length: number;
  /** Internal diameter, m. */
  diameter: number;
  /** Hazen-Williams coefficient C (dimensionless, e.g. 140 for PVC). Not a roughness height. */
  hazenWilliamsC: number;
  /** Absolute roughness ε for Darcy-Weisbach, m (e.g. 0.0000015 for PVC). */
  roughness: number;
}

/** Pump head curve H(Q) = a − b·Q^c, with Q in m³/s and H in m. */
export interface PumpCurve {
  a: number;
  b: number;
  c: number;
}

export interface PumpCurvePoint {
  /** m³/s */
  flow: number;
  /** m */
  head: number;
}

export interface Pump {
  id: string;
  /** Suction node id. The pump only adds head in the direction from → to. */
  from: string;
  /** Discharge node id. */
  to: string;
  curve: PumpCurve;
}

export interface Network {
  junctions: Junction[];
  reservoirs: Reservoir[];
  pipes: Pipe[];
  pumps: Pump[];
}

export interface SolveOptions {
  formula: HeadLossFormula;
  /** Kinematic viscosity of water, m²/s. Used by Darcy-Weisbach only. */
  kinematicViscosity: number;
  maxIterations: number;
  /** Convergence: Σ|ΔQ| / Σ|Q| below this value. */
  flowTolerance: number;
}

export interface NodeResult {
  id: string;
  /** Hydraulic grade line (cota piezométrica), m. */
  head: number;
  /** Ground elevation, m. For reservoirs this equals the head. */
  elevation: number;
  /** Pressure head = head − elevation, m (mca). */
  pressure: number;
  /** m³/s. For reservoirs: net outflow into the network (negative demand convention not used). */
  demand: number;
}

export interface PipeResult {
  id: string;
  /** m³/s, signed: positive from `from` to `to`. */
  flow: number;
  /** m/s, signed like the flow. */
  velocity: number;
  /** Head loss from `from` to `to`, m, signed like the flow (head[from] − head[to]). */
  headLoss: number;
  /** |headLoss| / length, m/m. */
  unitHeadLoss: number;
  /** Darcy friction factor (only for Darcy-Weisbach). */
  frictionFactor?: number;
  /** Reynolds number (only for Darcy-Weisbach). */
  reynolds?: number;
}

export interface PumpResult {
  id: string;
  /** m³/s */
  flow: number;
  /** Head added by the pump, m. */
  head: number;
}

export interface SolveResult {
  converged: boolean;
  iterations: number;
  /** Final value of Σ|ΔQ| / Σ|Q|. */
  residual: number;
  formula: HeadLossFormula;
  nodes: Record<string, NodeResult>;
  pipes: Record<string, PipeResult>;
  pumps: Record<string, PumpResult>;
}

// ---------------------------------------------------------------------------
// Hardy Cross (teaching module)
// ---------------------------------------------------------------------------

export interface LoopPipe {
  pipeId: string;
  /** +1 if the pipe's from→to direction follows the loop direction (clockwise), −1 otherwise. */
  direction: 1 | -1;
}

export interface Loop {
  id: string;
  pipes: LoopPipe[];
}

export interface HardyCrossPipeRow {
  pipeId: string;
  direction: 1 | -1;
  /** Flow before this iteration's correction, in the loop direction (signed), m³/s. */
  flow: number;
  /** Head loss in the loop direction (same sign as `flow`), m. */
  headLoss: number;
  /** n·|hL|/|Q|, s/m². */
  nHeadLossOverFlow: number;
  /** Flow after the correction of this loop (and of adjacent loops already applied), m³/s. */
  correctedFlow: number;
}

export interface HardyCrossLoopStep {
  loopId: string;
  rows: HardyCrossPipeRow[];
  /** Σ signed head loss around the loop, m. */
  sumHeadLoss: number;
  /** Σ n·|hL|/|Q|. */
  sumNHeadLossOverFlow: number;
  /** ΔQ = −Σ hL / Σ (n·|hL|/|Q|), m³/s, in the loop direction. */
  deltaQ: number;
}

export interface HardyCrossIteration {
  iteration: number;
  loops: HardyCrossLoopStep[];
  /** max |ΔQ| over loops in this iteration, m³/s. */
  maxDeltaQ: number;
}

export interface HardyCrossResult {
  converged: boolean;
  iterations: HardyCrossIteration[];
  /** Initial flows used (pipe from→to sign convention), m³/s. */
  initialFlows: Record<string, number>;
  /** Final flows by pipe id, pipe from→to sign convention, m³/s. */
  flows: Record<string, number>;
}

export interface HardyCrossOptions {
  formula: HeadLossFormula;
  kinematicViscosity: number;
  maxIterations: number;
  /** Stop when max |ΔQ| is below this value, m³/s. */
  tolerance: number;
}

// ---------------------------------------------------------------------------
// Checks (NBR 12218:2017)
// ---------------------------------------------------------------------------

export type CheckId =
  | 'minDynamicPressure'
  | 'maxStaticPressure'
  | 'minVelocity'
  | 'maxVelocity'
  | 'minDiameter'
  | 'convergence';

/** `error` blocks stage completion; `warning` is shown but does not block. */
export type CheckSeverity = 'error' | 'warning';

export type CheckSetting = CheckSeverity | 'off';

export type CheckSettings = Record<Exclude<CheckId, 'convergence'>, CheckSetting>;

export interface CheckLimits {
  /** m */
  minDynamicPressure: number;
  /** m */
  maxStaticPressure: number;
  /** m/s */
  minVelocity: number;
  /** m/s */
  maxVelocity: number;
  /** m (nominal) */
  minDiameter: number;
}

export interface CheckIssue {
  check: CheckId;
  severity: CheckSeverity;
  elementType: 'node' | 'pipe' | 'network';
  elementId: string;
  /** Computed value, SI. */
  value: number;
  /** Limit that was violated, SI. */
  limit: number;
  /** Plain explanation of what failed and how to fix it. */
  explanation: LocalizedText;
}

export interface CheckReport {
  /** True when there is no issue with severity `error`. */
  passed: boolean;
  issues: CheckIssue[];
  /** Static pressure head per junction id, m. */
  staticPressure: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

export interface CatalogPipe {
  /** Nominal diameter, mm. */
  dn: number;
  /** Internal diameter used in hydraulic calculations, mm. */
  internalDiameterMm: number;
  material: 'PVC' | 'PEAD';
  /** Illustrative supply + installation price, R$/m. */
  pricePerMeter: number;
}
