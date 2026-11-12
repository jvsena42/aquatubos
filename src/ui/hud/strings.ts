import type { LocalizedText } from '../../engine/types';

export const hudStrings = {
  label: { pt: 'Situação do projeto', en: 'Design status' },
  houses: { pt: 'Casas atendidas', en: 'Houses served' },
  housesOf: (served: string, total: number): LocalizedText => ({
    pt: `${served} de ${total} casas atendidas`,
    en: `${served} of ${total} houses served`,
  }),
  staleNote: {
    pt: 'Resultado anterior à última alteração',
    en: 'Result from before the last change',
  },
  cost: { pt: 'Custo', en: 'Cost' },
  budget: (value: string): LocalizedText => ({
    pt: `Orçamento ${value}`,
    en: `Budget ${value}`,
  }),
  withinBudget: (value: string): LocalizedText => ({
    pt: `Sobram ${value}`,
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
  barLabel: { pt: 'Custo em relação ao orçamento', en: 'Cost against the budget' },
  budgetMark: { pt: 'Orçamento', en: 'Budget' },
  referenceMark: { pt: 'Referência', en: 'Reference' },
  stars: { pt: 'Estrelas', en: 'Stars' },
  starsPending: { pt: 'Calcule para ver', en: 'Run the calculation' },
  starsFailing: { pt: 'Projeto ainda reprovado', en: 'Design not passing yet' },
  starsMax: { pt: 'Nota máxima', en: 'Top rating' },
  nextStar: (value: string): LocalizedText => ({
    pt: `Próxima estrela com custo ≤ ${value}`,
    en: `Next star at cost ≤ ${value}`,
  }),
  objective: { pt: 'Objetivo', en: 'Objective' },
  allObjectives: (count: number): LocalizedText => ({
    pt: `Ver os ${count} objetivos`,
    en: `See all ${count} objectives`,
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
