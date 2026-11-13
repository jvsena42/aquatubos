import type { CheckId, CheckSeverity, LocalizedText } from '../../engine/types';

export const checksStrings = {
  notVerified: { pt: 'Não verificado', en: 'Not verified' },
  solving: { pt: 'Calculando…', en: 'Calculating…' },
  stale: { pt: 'Desatualizado', en: 'Out of date' },
  passed: { pt: 'Aprovado', en: 'Passed' },
  failed: { pt: 'Reprovado', en: 'Failed' },
  nextStage: { pt: 'Próxima etapa', en: 'Next stage' },
  errorTitle: { pt: 'Não foi possível calcular', en: 'The calculation failed' },
  issues: { pt: 'Pendências', en: 'Issues' },
  issueCount: (count: number): LocalizedText => ({
    pt: count === 0 ? 'Sem pendências' : count === 1 ? '1 pendência' : `${count} pendências`,
    en: count === 0 ? 'No issues' : count === 1 ? '1 issue' : `${count} issues`,
  }),
  pipe: (id: string): LocalizedText => ({ pt: `Trecho ${id}`, en: `Pipe ${id}` }),
  node: (id: string): LocalizedText => ({ pt: `Nó ${id}`, en: `Node ${id}` }),
  network: { pt: 'Rede', en: 'Network' },
  selectHint: { pt: 'Selecionar na rede', en: 'Select in the network' },
  /** Help of an issue: the limit that applies, after the explanation of the engine. */
  limit: (limit: string, standard: string): LocalizedText => ({
    pt: `Limite: ${limit} (${standard}).`,
    en: `Limit: ${limit} (${standard}).`,
  }),
  atLeast: (value: string): LocalizedText => ({
    pt: `mínimo de ${value}`,
    en: `at least ${value}`,
  }),
  atMost: (value: string): LocalizedText => ({ pt: `máximo de ${value}`, en: `at most ${value}` }),
} as const;

export const severityLabels: Record<CheckSeverity, LocalizedText> = {
  error: { pt: 'Erro', en: 'Error' },
  warning: { pt: 'Aviso', en: 'Warning' },
};

/** Short names of the checks: the label of an issue line and the topic of its help. */
export const checkLabels: Record<CheckId, LocalizedText> = {
  minDynamicPressure: { pt: 'Pressão mín.', en: 'Min. pressure' },
  maxStaticPressure: { pt: 'Pressão estática máx.', en: 'Max. static pressure' },
  minVelocity: { pt: 'Velocidade mín.', en: 'Min. velocity' },
  maxVelocity: { pt: 'Velocidade máx.', en: 'Max. velocity' },
  minDiameter: { pt: 'Diâmetro mín.', en: 'Min. diameter' },
  convergence: { pt: 'Convergência', en: 'Convergence' },
};
