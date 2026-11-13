import type { LocalizedText } from '../../engine/types';

export const stagesStrings = {
  heading: { pt: 'Etapas', en: 'Stages' },
  home: { pt: 'Início', en: 'Home' },
  totalStars: { pt: 'Estrelas', en: 'Stars' },
  next: { pt: 'Próxima', en: 'Next' },
  nextHint: { pt: 'Próxima etapa a jogar', en: 'Next stage to play' },
  /** Behind the "?" next to the heading. */
  introTopic: { pt: 'Como funciona', en: 'How it works' },
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

/** Names of 1 to 3 words for the map and the title screen, by stage id. */
export const STAGE_SHORT_TITLES: Readonly<Record<string, LocalizedText>> = {
  stage1: { pt: 'Gravidade', en: 'Gravity' },
  stage2: { pt: 'Terreno', en: 'Terrain' },
  stage3: { pt: 'Um anel', en: 'One ring' },
  stage4: { pt: 'Três anéis', en: 'Three rings' },
  stage5: { pt: 'Bombeamento', en: 'Pumping' },
};

/** Short name of a stage; the full title for a stage that has none. */
export function shortTitle(stage: { id: string; title: LocalizedText }): LocalizedText {
  return STAGE_SHORT_TITLES[stage.id] ?? stage.title;
}
