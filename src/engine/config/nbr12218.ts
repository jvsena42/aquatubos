import type { CheckLimits } from '../types';

/**
 * Design criteria used by the checks, labelled after ABNT NBR 12218:2017
 * (Projeto de rede de distribuição de água para abastecimento público).
 * This is the only place where these constants are defined.
 */
export const NBR_12218 = {
  reference: 'ABNT NBR 12218:2017',
  /** Minimum dynamic pressure head, m (100 kPa ≈ 10 mca). */
  minDynamicPressure: 10,
  /** Maximum static pressure head, m (400 kPa ≈ 40 mca). */
  maxStaticPressure: 40,
  /** Minimum velocity, m/s. */
  minVelocity: 0.6,
  /** Maximum velocity, m/s. */
  maxVelocity: 3.5,
  /** Minimum nominal diameter, m (DN 50). */
  minDiameter: 0.05,
  /** Coefficient of the day of highest consumption. */
  k1: 1.2,
  /** Coefficient of the hour of highest consumption. */
  k2: 1.5,
} as const;

export const NBR_CHECK_LIMITS: CheckLimits = {
  minDynamicPressure: NBR_12218.minDynamicPressure,
  maxStaticPressure: NBR_12218.maxStaticPressure,
  minVelocity: NBR_12218.minVelocity,
  maxVelocity: NBR_12218.maxVelocity,
  minDiameter: NBR_12218.minDiameter,
};
