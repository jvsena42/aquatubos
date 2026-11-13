import type { LocalizedText } from '../../engine/types';

export const hudStrings = {
  label: { pt: 'Situação do projeto', en: 'Design status' },
  houses: { pt: 'Casas atendidas', en: 'Houses served' },
  staleNote: {
    pt: 'Resultado anterior à última alteração',
    en: 'Result from before the last change',
  },
  cost: { pt: 'Custo', en: 'Cost' },
  costOverBudget: { pt: 'Custo, acima do orçamento', en: 'Cost, over the budget' },
  stars: { pt: 'Estrelas', en: 'Stars' },
  barLabel: { pt: 'Custo em relação ao orçamento', en: 'Cost against the budget' },

  // Help: what each number means. Shown behind the "?" buttons, never in the default view.
  housesHelp: {
    pt: 'Casas em nós sem falha de pressão no último cálculo. A etapa só é aprovada com todas atendidas.',
    en: 'Houses at nodes with no pressure failure in the last calculation. The stage only passes with all of them served.',
  },
  costHelp: {
    pt: 'Soma, em todos os trechos, do preço por metro do diâmetro escolhido × o comprimento.',
    en: 'Sum, over all pipes, of the price per metre of the chosen diameter × the length.',
  },
  costNow: (value: string): LocalizedText => ({
    pt: `Custo atual: ${value}.`,
    en: `Cost now: ${value}.`,
  }),
  budget: (value: string): LocalizedText => ({
    pt: `Orçamento ${value}`,
    en: `Budget ${value}`,
  }),
  withinBudget: (value: string): LocalizedText => ({
    pt: `sobram ${value}`,
    en: `${value} to spare`,
  }),
  overBudget: (value: string): LocalizedText => ({
    pt: `Acima do orçamento em ${value}`,
    en: `Over budget by ${value}`,
  }),
  reference: (value: string): LocalizedText => ({
    pt: `Referência ${value}`,
    en: `Reference ${value}`,
  }),
  aboveReference: (percent: string): LocalizedText => ({
    pt: `${percent} % acima`,
    en: `${percent}% above`,
  }),
  belowReference: (percent: string): LocalizedText => ({
    pt: `${percent} % abaixo`,
    en: `${percent}% below`,
  }),
  equalToReference: { pt: 'igual', en: 'equal' },
  starsHelp: (three: string, two: string): LocalizedText => ({
    pt: `1 estrela: projeto aprovado. 2 estrelas: custo até ${two} % acima da solução de referência. 3 estrelas: até ${three} %.`,
    en: `1 star: the design passes. 2 stars: cost up to ${two}% above the reference solution. 3 stars: up to ${three}%.`,
  }),
  starsPending: {
    pt: 'Calcule para ver as estrelas.',
    en: 'Run the calculation to see the stars.',
  },
  starsFailing: { pt: 'Projeto ainda reprovado.', en: 'Design not passing yet.' },
  starsMax: { pt: 'Nota máxima.', en: 'Top rating.' },
  nextStar: (value: string): LocalizedText => ({
    pt: `Próxima estrela com custo ≤ ${value}.`,
    en: `Next star at cost ≤ ${value}.`,
  }),
  objectivesTitle: { pt: 'Objetivos da etapa', en: 'Stage objectives' },

  announcePassed: (served: number, total: number, stars: number): LocalizedText => ({
    pt: `Etapa aprovada: ${served} de ${total} casas atendidas, ${stars} ${stars === 1 ? 'estrela' : 'estrelas'}`,
    en: `Stage passed: ${served} of ${total} houses served, ${stars} ${stars === 1 ? 'star' : 'stars'}`,
  }),
  announceFailed: (served: number, total: number): LocalizedText => ({
    pt: `${served} de ${total} casas atendidas`,
    en: `${served} of ${total} houses served`,
  }),
  announceOverBudget: { pt: 'custo acima do orçamento', en: 'cost over the budget' },
  announceChecksFailing: {
    pt: 'ainda há critérios não atendidos',
    en: 'some criteria are still not met',
  },
} as const;
