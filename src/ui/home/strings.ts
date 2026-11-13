import type { LocalizedText } from '../../engine/types';

export const REPO_URL = 'https://github.com/jvsena42/aquatubos';
export const ORIGINAL_URL = 'https://github.com/jvsena42/aquaplay_tcc';

export const homeStrings = {
  tagline: {
    pt: 'Projete a rede de água da cidade',
    en: "Design the town's water network",
  },
  /** Behind the "?" next to the tagline, and in the credits. */
  helpTopic: { pt: 'O que é o Aquatubos', en: 'What is Aquatubos' },
  lead: {
    pt: 'Aprenda dimensionamento de redes de distribuição: Hazen-Williams, redes malhadas com Hardy Cross, orçamento e bombeamento, segundo a NBR 12218.',
    en: 'Learn to size water distribution networks: Hazen-Williams, looped networks with Hardy Cross, budget and pumping, following NBR 12218.',
  },
  saved: {
    pt: 'O progresso fica salvo neste dispositivo.',
    en: 'Progress is saved on this device.',
  },
  play: { pt: 'Jogar', en: 'Play' },
  continue: { pt: 'Continuar', en: 'Continue' },
  stageMap: { pt: 'Mapa de etapas', en: 'Stage map' },

  progress: { pt: 'Seu progresso', en: 'Your progress' },
  stars: { pt: 'Estrelas', en: 'Stars' },
  stagesCompleted: { pt: 'Etapas concluídas', en: 'Stages completed' },
  /** Unit after the count of completed stages, as in "2/5 etapas". */
  stagesUnit: { pt: 'etapas', en: 'stages' },
  bestCost: (stages: number): LocalizedText => ({
    pt: `Melhor custo somado (${stages} ${stages === 1 ? 'etapa' : 'etapas'})`,
    en: `Best total cost (${stages} ${stages === 1 ? 'stage' : 'stages'})`,
  }),
} as const;

export const howToStrings = {
  title: { pt: 'Como jogar', en: 'How to play' },
  previous: { pt: 'Anterior', en: 'Previous' },
  next: { pt: 'Próximo', en: 'Next' },
  done: { pt: 'Entendi', en: 'Got it' },
  steps: { pt: 'Passos', en: 'Steps' },
  stepOf: (step: number, total: number): LocalizedText => ({
    pt: `Passo ${step} de ${total}`,
    en: `Step ${step} of ${total}`,
  }),
} as const;

export interface HowToStep {
  title: LocalizedText;
  text: LocalizedText;
}

/** One short sentence per step. */
export const HOW_TO_STEPS: readonly HowToStep[] = [
  {
    title: { pt: 'Escolha os diâmetros', en: 'Choose the diameters' },
    text: {
      pt: 'Toque em um trecho e escolha o diâmetro (DN).',
      en: 'Tap a pipe and choose its diameter (DN).',
    },
  },
  {
    title: { pt: 'Calcule e verifique', en: 'Calculate and check' },
    text: {
      pt: 'Calcule a rede para ver vazões, velocidades e pressões.',
      en: 'Calculate the network to see flows, velocities and pressures.',
    },
  },
  {
    title: { pt: 'Veja as casas atendidas', en: 'See the houses served' },
    text: {
      pt: 'Casas com pressão suficiente ficam atendidas.',
      en: 'Houses with enough pressure are served.',
    },
  },
  {
    title: { pt: 'Ganhe estrelas pelo custo', en: 'Earn stars for cost' },
    text: {
      pt: 'Passe nas verificações gastando pouco: até três estrelas.',
      en: 'Pass the checks at a low cost: up to three stars.',
    },
  },
];

export const aboutStrings = {
  title: { pt: 'Sobre o Aquatubos', en: 'About Aquatubos' },
  what: {
    pt: 'Jogo educativo de redes de distribuição de água para estudantes de engenharia civil.',
    en: 'An educational game about water distribution networks for civil engineering students.',
  },
  disclaimer: {
    pt: 'Ferramenta de ensino, não um software de projeto: não use os resultados em projetos reais.',
    en: 'A teaching tool, not design software: do not use its results in real designs.',
  },
  basis: [
    {
      pt: 'Verificações da ABNT NBR 12218:2017.',
      en: 'Checks from ABNT NBR 12218:2017.',
    },
    {
      pt: 'Solver validado contra o EPANET.',
      en: 'Solver validated against EPANET.',
    },
    {
      pt: 'Preços dos tubos ilustrativos.',
      en: 'Pipe prices are illustrative.',
    },
  ],
  origin: {
    pt: 'Sucede o Aquatubos original (Unity, 2021):',
    en: 'Succeeds the original Aquatubos (Unity, 2021):',
  },
  originLink: { pt: 'Repositório do aplicativo original', en: 'Repository of the original app' },
  source: { pt: 'Software livre, licença MIT:', en: 'Free software, MIT licence:' },
  sourceLink: { pt: 'Código-fonte no GitHub', en: 'Source code on GitHub' },
  newTab: { pt: '(abre em nova aba)', en: '(opens in a new tab)' },
} as const;
