import type { CheckId, CheckSeverity, LocalizedText } from '../../engine/types';

export const checksStrings = {
  notVerified: { pt: 'Ainda não verificado', en: 'Not verified yet' },
  notVerifiedHint: {
    pt: 'Use “Calcular / Verificar” para conferir o projeto.',
    en: 'Use “Calculate / Verify” to check the design.',
  },
  solving: { pt: 'Calculando…', en: 'Calculating…' },
  stale: { pt: 'Desatualizado', en: 'Out of date' },
  staleHint: {
    pt: 'Os valores abaixo são do último cálculo. O projeto mudou depois dele.',
    en: 'The values below come from the last calculation. The design changed after it.',
  },
  passed: { pt: 'Aprovado', en: 'Passed' },
  failed: { pt: 'Reprovado', en: 'Failed' },
  success: {
    pt: 'A rede atende a todos os critérios desta etapa.',
    en: 'The network meets every criterion of this stage.',
  },
  nextStage: { pt: 'Próxima etapa', en: 'Next stage' },
  errorTitle: { pt: 'Não foi possível calcular', en: 'The calculation failed' },
  cost: { pt: 'Custo', en: 'Cost' },
  budget: { pt: 'Orçamento', en: 'Budget' },
  withinBudget: { pt: 'Dentro do orçamento', en: 'Within budget' },
  overBudget: { pt: 'Acima do orçamento', en: 'Over budget' },
  rating: { pt: 'Avaliação', en: 'Rating' },
  referenceCost: { pt: 'Custo de referência', en: 'Reference cost' },
  equalToReference: {
    pt: 'Seu projeto custa o mesmo que a solução de referência.',
    en: 'Your design costs the same as the reference solution.',
  },
  aboveReference: (percent: string): LocalizedText => ({
    pt: `Seu projeto custa ${percent}% a mais que a solução de referência.`,
    en: `Your design costs ${percent}% more than the reference solution.`,
  }),
  belowReference: (percent: string): LocalizedText => ({
    pt: `Seu projeto custa ${percent}% a menos que a solução de referência.`,
    en: `Your design costs ${percent}% less than the reference solution.`,
  }),
  issues: { pt: 'Pendências', en: 'Issues' },
  noIssues: { pt: 'Nenhuma pendência encontrada.', en: 'No issues found.' },
  pipe: (id: string): LocalizedText => ({ pt: `Trecho ${id}`, en: `Pipe ${id}` }),
  node: (id: string): LocalizedText => ({ pt: `Nó ${id}`, en: `Node ${id}` }),
  network: { pt: 'Rede', en: 'Network' },
  selectHint: { pt: 'Selecionar na rede', en: 'Select in the network' },
} as const;

export const severityLabels: Record<CheckSeverity, LocalizedText> = {
  error: { pt: 'Erro', en: 'Error' },
  warning: { pt: 'Aviso', en: 'Warning' },
};

export const checkLabels: Record<CheckId, LocalizedText> = {
  minDynamicPressure: { pt: 'Pressão dinâmica mínima', en: 'Minimum dynamic pressure' },
  maxStaticPressure: { pt: 'Pressão estática máxima', en: 'Maximum static pressure' },
  minVelocity: { pt: 'Velocidade mínima', en: 'Minimum velocity' },
  maxVelocity: { pt: 'Velocidade máxima', en: 'Maximum velocity' },
  minDiameter: { pt: 'Diâmetro mínimo', en: 'Minimum diameter' },
  convergence: { pt: 'Convergência do cálculo', en: 'Calculation convergence' },
};
