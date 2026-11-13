import type { LocalizedText } from '../../engine/types';

export const homeStrings = {
  tagline: {
    pt: 'Projete a rede de água da cidade',
    en: "Design the town's water network",
  },
  lead: {
    pt: 'Aprenda dimensionamento de redes de distribuição: Hazen-Williams, redes malhadas com Hardy Cross, orçamento e bombeamento, segundo a NBR 12218.',
    en: 'Learn to size water distribution networks: Hazen-Williams, looped networks with Hardy Cross, budget and pumping, following NBR 12218.',
  },
  play: { pt: 'Jogar', en: 'Play' },
  continue: { pt: 'Continuar', en: 'Continue' },
  stageMap: { pt: 'Mapa de etapas', en: 'Stage map' },
  allDone: { pt: 'Todas as etapas concluídas', en: 'All stages completed' },
  glossary: { pt: 'Glossário', en: 'Glossary' },
  more: { pt: 'Ajuda e informações', en: 'Help and information' },

  progress: { pt: 'Seu progresso', en: 'Your progress' },
  noProgress: {
    pt: 'Nenhuma etapa concluída ainda. O progresso fica salvo neste dispositivo.',
    en: 'No stages completed yet. Progress is saved on this device.',
  },
  stars: { pt: 'Estrelas', en: 'Stars' },
  stagesCompleted: { pt: 'Etapas concluídas', en: 'Stages completed' },
  bestCost: (stages: number): LocalizedText => ({
    pt: `Melhor custo somado (${stages} ${stages === 1 ? 'etapa' : 'etapas'})`,
    en: `Best total cost (${stages} ${stages === 1 ? 'stage' : 'stages'})`,
  }),
} as const;
