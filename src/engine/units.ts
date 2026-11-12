/** Unit conversions between SI (engine) and display units. */

export const GRAVITY = 9.80665; // m/s²
/** Kinematic viscosity of water at 20 °C, m²/s. */
export const WATER_KINEMATIC_VISCOSITY = 1.004e-6;

export const lpsToM3s = (lps: number): number => lps / 1000;
export const m3sToLps = (m3s: number): number => m3s * 1000;
export const mmToM = (mm: number): number => mm / 1000;
export const mToMm = (m: number): number => m * 1000;

/** Cross-section area of a circular pipe, m². */
export const pipeArea = (diameter: number): number => (Math.PI * diameter * diameter) / 4;

/** Mean velocity, m/s (signed like the flow). */
export const velocity = (flow: number, diameter: number): number => flow / pipeArea(diameter);
