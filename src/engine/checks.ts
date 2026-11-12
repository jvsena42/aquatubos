import { NBR_12218, NBR_CHECK_LIMITS } from './config/nbr12218';
import { DEFAULT_SOLVE_OPTIONS } from './solver';
import type {
  CheckId,
  CheckIssue,
  CheckLimits,
  CheckReport,
  CheckSettings,
  CheckSeverity,
  LocalizedText,
  Network,
  SolveResult,
} from './types';
import { m3sToLps, mToMm } from './units';

export const DEFAULT_CHECK_SETTINGS: CheckSettings = {
  minDynamicPressure: 'error',
  maxStaticPressure: 'error',
  minVelocity: 'warning',
  maxVelocity: 'error',
  minDiameter: 'error',
};

/** Absolute slack of the comparisons, so a value that sits on the limit is not reported. */
const COMPARISON_TOLERANCE = 1e-9;

/**
 * Static pressure head per junction, m: the no-flow condition. The static head of a junction is
 * the highest head among the reservoirs it is connected to; a pump on the way adds its shutoff
 * head in the from → to direction.
 *
 * Pipes carry the static head in both directions. A pump carries it only from suction to
 * discharge (no backflow through a stopped pump). A junction that no reservoir reaches has no
 * static head and is left out of the result.
 */
export function staticPressures(network: Network): Record<string, number> {
  const head = new Map<string, number>();
  const reservoirIds = new Set<string>();
  for (const reservoir of network.reservoirs) {
    head.set(reservoir.id, reservoir.head);
    reservoirIds.add(reservoir.id);
  }

  const raise = (nodeId: string, candidate: number | undefined): boolean => {
    if (candidate === undefined || reservoirIds.has(nodeId)) return false;
    const current = head.get(nodeId);
    if (current !== undefined && current >= candidate) return false;
    head.set(nodeId, candidate);
    return true;
  };

  // Relaxation: every pass spreads the highest head one more link. The number of passes is
  // bounded by the number of nodes, which also stops a pump placed inside a loop from adding
  // its head again and again.
  const maxPasses = network.junctions.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const pipe of network.pipes) {
      changed = raise(pipe.to, head.get(pipe.from)) || changed;
      changed = raise(pipe.from, head.get(pipe.to)) || changed;
    }
    for (const pump of network.pumps) {
      const suction = head.get(pump.from);
      changed =
        raise(pump.to, suction === undefined ? undefined : suction + pump.curve.a) || changed;
    }
    if (!changed) break;
  }

  const pressures: Record<string, number> = {};
  for (const junction of network.junctions) {
    const staticHead = head.get(junction.id);
    if (staticHead !== undefined) pressures[junction.id] = staticHead - junction.elevation;
  }
  return pressures;
}

type Lang = keyof LocalizedText;

/** Fixed number of decimals, comma in pt and point in en. */
function fixed(value: number, lang: Lang, decimals = 2): string {
  let text = value.toFixed(decimals);
  if (Number(text) === 0) text = (0).toFixed(decimals);
  return lang === 'pt' ? text.replace('.', ',') : text;
}

/** Up to two decimals without trailing zeros: 10, 0.6, 3.5. */
function compact(value: number, lang: Lang): string {
  const text = String(Number(value.toFixed(2)));
  return lang === 'pt' ? text.replace('.', ',') : text;
}

/** Text for both languages from one template. */
function localized(build: (lang: Lang) => string): LocalizedText {
  return { pt: build('pt'), en: build('en') };
}

/** Pressure head unit: metres of water column. */
const HEAD_UNIT: LocalizedText = { pt: 'mca', en: 'm H2O' };

/** " (ABNT NBR 12218:2017)" when the limit in use is the one of the standard. */
function standardNote(check: keyof CheckLimits, limits: CheckLimits): string {
  return limits[check] === NBR_CHECK_LIMITS[check] ? ` (${NBR_12218.reference})` : '';
}

function severityOf(settings: CheckSettings, check: keyof CheckSettings): CheckSeverity | null {
  const setting = settings[check];
  return setting === 'off' ? null : setting;
}

/**
 * Compares a solved network against the design criteria. Each violation becomes one issue with
 * an explanation in pt and en that includes the computed value, the limit and a suggestion.
 * A non-converged result adds a `convergence` error.
 *
 * Order of the issues: convergence first (when the solver did not converge the other numbers
 * are not reliable), then minimum dynamic pressure, maximum static pressure, minimum velocity,
 * maximum velocity and minimum diameter; inside each check, the order of the junctions or
 * pipes in the network. Velocities are compared in absolute value. Elements that are missing
 * from `result` are skipped.
 */
export function runChecks(
  network: Network,
  result: SolveResult,
  settings: CheckSettings = DEFAULT_CHECK_SETTINGS,
  limits: CheckLimits = NBR_CHECK_LIMITS,
): CheckReport {
  const issues: CheckIssue[] = [];
  const staticPressure = staticPressures(network);

  if (!result.converged) {
    issues.push({
      check: 'convergence',
      severity: 'error',
      elementType: 'network',
      elementId: 'network',
      value: result.residual,
      limit: DEFAULT_SOLVE_OPTIONS.flowTolerance,
      explanation: {
        pt:
          `O cálculo hidráulico não convergiu em ${result.iterations} iterações, portanto as ` +
          'pressões e vazões mostradas não são confiáveis. Verifique se há trechos com diâmetro ' +
          'muito pequeno para a vazão ou dados incoerentes e calcule novamente.',
        en:
          `The hydraulic calculation did not converge in ${result.iterations} iterations, so ` +
          'the pressures and flows shown are not reliable. Check for pipes that are far too ' +
          'small for their flow or for inconsistent data and calculate again.',
      },
    });
  }

  const pushIssue = (
    check: Exclude<CheckId, 'convergence'>,
    severity: CheckSeverity,
    elementType: 'node' | 'pipe',
    elementId: string,
    value: number,
    explanation: LocalizedText,
  ): void => {
    issues.push({
      check,
      severity,
      elementType,
      elementId,
      value,
      limit: limits[check],
      explanation,
    });
  };

  const minPressureSeverity = severityOf(settings, 'minDynamicPressure');
  if (minPressureSeverity) {
    const limit = limits.minDynamicPressure;
    const note = standardNote('minDynamicPressure', limits);
    for (const junction of network.junctions) {
      const pressure = result.nodes[junction.id]?.pressure;
      if (pressure === undefined || pressure >= limit - COMPARISON_TOLERANCE) continue;
      const atRest = staticPressure[junction.id];
      // When even the static pressure is below the minimum, larger pipes cannot fix the node.
      const lacksHead = atRest !== undefined && atRest < limit - COMPARISON_TOLERANCE;
      pushIssue(
        'minDynamicPressure',
        minPressureSeverity,
        'node',
        junction.id,
        pressure,
        localized((lang) => {
          const unit = HEAD_UNIT[lang];
          const value = fixed(pressure, lang);
          const minimum = compact(limit, lang);
          if (lang === 'pt') {
            const head = `Nó ${junction.id}: pressão dinâmica de ${value} ${unit}, abaixo do mínimo de ${minimum} ${unit}${note}. `;
            return lacksHead
              ? `${head}Mesmo sem escoamento a pressão seria de apenas ${fixed(atRest, lang)} ${unit}, então aumentar diâmetros não resolve: é preciso mais carga na origem (reservatório mais alto ou bomba).`
              : `${head}Aumente o diâmetro dos trechos a montante para reduzir a perda de carga.`;
          }
          const head = `Node ${junction.id}: dynamic pressure of ${value} ${unit}, below the minimum of ${minimum} ${unit}${note}. `;
          return lacksHead
            ? `${head}Even with no flow the pressure would be only ${fixed(atRest, lang)} ${unit}, so larger pipes cannot fix it: the source needs more head (a higher reservoir or a pump).`
            : `${head}Increase the diameter of the upstream pipes to reduce the head loss.`;
        }),
      );
    }
  }

  const maxStaticSeverity = severityOf(settings, 'maxStaticPressure');
  if (maxStaticSeverity) {
    const limit = limits.maxStaticPressure;
    const note = standardNote('maxStaticPressure', limits);
    for (const junction of network.junctions) {
      const pressure = staticPressure[junction.id];
      if (pressure === undefined || pressure <= limit + COMPARISON_TOLERANCE) continue;
      pushIssue(
        'maxStaticPressure',
        maxStaticSeverity,
        'node',
        junction.id,
        pressure,
        localized((lang) => {
          const unit = HEAD_UNIT[lang];
          const value = fixed(pressure, lang);
          const maximum = compact(limit, lang);
          return lang === 'pt'
            ? `Nó ${junction.id}: pressão estática de ${value} ${unit}, acima do máximo de ${maximum} ${unit}${note}. A pressão estática não depende dos diâmetros: divida a rede em zonas de pressão ou instale uma válvula redutora de pressão (VRP) a montante do nó.`
            : `Node ${junction.id}: static pressure of ${value} ${unit}, above the maximum of ${maximum} ${unit}${note}. Static pressure does not depend on the diameters: split the network into pressure zones or install a pressure reducing valve (PRV) upstream of the node.`;
        }),
      );
    }
  }

  const describeFlow = (pipeId: string, diameter: number, lang: Lang): string => {
    const flow = Math.abs(result.pipes[pipeId]?.flow ?? 0);
    const flowText = `${fixed(m3sToLps(flow), lang)} L/s`;
    const dn = `${compact(mToMm(diameter), lang)} mm`;
    return lang === 'pt'
      ? `vazão de ${flowText} no diâmetro de ${dn}`
      : `flow of ${flowText} in a ${dn} diameter`;
  };

  const minVelocitySeverity = severityOf(settings, 'minVelocity');
  if (minVelocitySeverity) {
    const limit = limits.minVelocity;
    const note = standardNote('minVelocity', limits);
    for (const pipe of network.pipes) {
      const signedVelocity = result.pipes[pipe.id]?.velocity;
      if (signedVelocity === undefined) continue;
      const speed = Math.abs(signedVelocity);
      if (speed >= limit - COMPARISON_TOLERANCE) continue;
      const atMinimumDiameter = pipe.diameter <= limits.minDiameter + COMPARISON_TOLERANCE;
      pushIssue(
        'minVelocity',
        minVelocitySeverity,
        'pipe',
        pipe.id,
        speed,
        localized((lang) => {
          const value = fixed(speed, lang);
          const minimum = compact(limit, lang);
          const context = describeFlow(pipe.id, pipe.diameter, lang);
          if (lang === 'pt') {
            const head = `Trecho ${pipe.id}: velocidade de ${value} m/s (${context}), abaixo do mínimo de ${minimum} m/s${note}. `;
            return atMinimumDiameter
              ? `${head}O trecho já está no diâmetro mínimo, então a velocidade baixa vem da vazão pequena e não pode ser corrigida com outro diâmetro.`
              : `${head}Reduza o diâmetro do trecho para aumentar a velocidade.`;
          }
          const head = `Pipe ${pipe.id}: velocity of ${value} m/s (${context}), below the minimum of ${minimum} m/s${note}. `;
          return atMinimumDiameter
            ? `${head}The pipe already has the minimum diameter, so the low velocity comes from the small flow and cannot be fixed with another diameter.`
            : `${head}Reduce the diameter of the pipe to increase the velocity.`;
        }),
      );
    }
  }

  const maxVelocitySeverity = severityOf(settings, 'maxVelocity');
  if (maxVelocitySeverity) {
    const limit = limits.maxVelocity;
    const note = standardNote('maxVelocity', limits);
    for (const pipe of network.pipes) {
      const signedVelocity = result.pipes[pipe.id]?.velocity;
      if (signedVelocity === undefined) continue;
      const speed = Math.abs(signedVelocity);
      if (speed <= limit + COMPARISON_TOLERANCE) continue;
      pushIssue(
        'maxVelocity',
        maxVelocitySeverity,
        'pipe',
        pipe.id,
        speed,
        localized((lang) => {
          const value = fixed(speed, lang);
          const maximum = compact(limit, lang);
          const context = describeFlow(pipe.id, pipe.diameter, lang);
          return lang === 'pt'
            ? `Trecho ${pipe.id}: velocidade de ${value} m/s (${context}), acima do máximo de ${maximum} m/s${note}. Aumente o diâmetro do trecho para reduzir a velocidade e a perda de carga.`
            : `Pipe ${pipe.id}: velocity of ${value} m/s (${context}), above the maximum of ${maximum} m/s${note}. Increase the diameter of the pipe to reduce the velocity and the head loss.`;
        }),
      );
    }
  }

  const minDiameterSeverity = severityOf(settings, 'minDiameter');
  if (minDiameterSeverity) {
    const limit = limits.minDiameter;
    const note = standardNote('minDiameter', limits);
    for (const pipe of network.pipes) {
      if (pipe.diameter >= limit - COMPARISON_TOLERANCE) continue;
      pushIssue(
        'minDiameter',
        minDiameterSeverity,
        'pipe',
        pipe.id,
        pipe.diameter,
        localized((lang) => {
          const value = compact(mToMm(pipe.diameter), lang);
          const minimum = compact(mToMm(limit), lang);
          return lang === 'pt'
            ? `Trecho ${pipe.id}: diâmetro de ${value} mm, abaixo do mínimo de ${minimum} mm${note}. Use DN ${minimum} ou maior neste trecho.`
            : `Pipe ${pipe.id}: diameter of ${value} mm, below the minimum of ${minimum} mm${note}. Use DN ${minimum} or larger in this pipe.`;
        }),
      );
    }
  }

  return {
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
    staticPressure,
  };
}
