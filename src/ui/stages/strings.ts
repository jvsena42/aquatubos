import type { LocalizedText } from '../../engine/types';

export const stagesStrings = {
  heading: { pt: 'Etapas', en: 'Stages' },
  intro: {
    pt: 'Cada etapa é um projeto de rede de distribuição de água. Escolha os diâmetros, calcule e verifique os critérios da NBR 12218. Concluir uma etapa libera a seguinte.',
    en: 'Each stage is a water distribution network design. Choose the diameters, run the calculation and check the NBR 12218 criteria. Completing a stage unlocks the next one.',
  },
  empty: {
    pt: 'Nenhuma etapa disponível nesta versão.',
    en: 'No stages are available in this version.',
  },
  unlockedLabel: (order: number, title: string): LocalizedText => ({
    pt: `Etapa ${order}: ${title}`,
    en: `Stage ${order}: ${title}`,
  }),
  locked: { pt: 'Bloqueada', en: 'Locked' },
  lockedHint: (previous: number): LocalizedText => ({
    pt: `Conclua a etapa ${previous} para liberar.`,
    en: `Complete stage ${previous} to unlock.`,
  }),
  lockedLabel: (order: number, title: string, previous: number): LocalizedText => ({
    pt: `Etapa ${order}: ${title}. Bloqueada: conclua a etapa ${previous} para liberar.`,
    en: `Stage ${order}: ${title}. Locked: complete stage ${previous} to unlock.`,
  }),
  completed: { pt: 'Concluída', en: 'Completed' },
  inProgress: { pt: 'Em andamento', en: 'In progress' },
  notStarted: { pt: 'Não iniciada', en: 'Not started' },
  bestCost: { pt: 'Melhor custo', en: 'Best cost' },
} as const;
