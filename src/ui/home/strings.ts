import type { LocalizedText } from '../../engine/types';

export const REPO_URL = 'https://github.com/jvsena42/aquatubos';
export const ORIGINAL_URL = 'https://github.com/jvsena42/aquaplay_tcc';

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
  howToPlay: { pt: 'Como jogar', en: 'How to play' },
  glossary: { pt: 'Glossário', en: 'Glossary' },
  about: { pt: 'Sobre', en: 'About' },
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

export const HOW_TO_STEPS: readonly HowToStep[] = [
  {
    title: { pt: 'Escolha os diâmetros', en: 'Choose the diameters' },
    text: {
      pt: 'Selecione um trecho da rede e escolha o diâmetro nominal (DN). Tubos maiores perdem menos carga, mas custam mais.',
      en: 'Select a pipe in the network and choose its nominal diameter (DN). Larger pipes lose less head but cost more.',
    },
  },
  {
    title: { pt: 'Calcule e verifique', en: 'Calculate and check' },
    text: {
      pt: 'Use o botão Calcular / Verificar para resolver a rede. O aplicativo calcula vazões, velocidades e pressões e mostra as contas.',
      en: 'Use the Calculate / Check button to solve the network. The app computes flows, velocities and pressures and shows the calculations.',
    },
  },
  {
    title: { pt: 'Veja as casas atendidas', en: 'See the houses served' },
    text: {
      pt: 'As casas com pressão suficiente ficam atendidas. As verificações mostram o que ainda não cumpre a NBR 12218 e o que mudar.',
      en: 'Houses with enough pressure are served. The checks show what still does not meet NBR 12218 and what to change.',
    },
  },
  {
    title: { pt: 'Ganhe estrelas pelo custo', en: 'Earn stars for cost' },
    text: {
      pt: 'A etapa é concluída quando o projeto passa nas verificações. Quanto mais perto do custo da solução de referência, mais estrelas, até três.',
      en: 'A stage is completed when the design passes the checks. The closer to the cost of the reference solution, the more stars, up to three.',
    },
  },
];

export const aboutStrings = {
  title: { pt: 'Sobre o Aquatubos', en: 'About Aquatubos' },
  what: (stages: number): LocalizedText => ({
    pt: `O Aquatubos é um jogo educativo para estudantes de engenharia civil. Em ${stages} etapas, você dimensiona redes de distribuição de água: troca os diâmetros dos trechos até o projeto cumprir os critérios da norma, com todas as contas à mostra.`,
    en: `Aquatubos is an educational game for civil engineering students. Over ${stages} stages you size water distribution networks: you change pipe diameters until the design meets the criteria of the standard, with every calculation shown.`,
  }),
  originHeading: { pt: 'Origem', en: 'Origin' },
  origin: {
    pt: 'Este aplicativo sucede o Aquatubos original (Unity, 2021), desenvolvido em um trabalho de conclusão de curso de graduação.',
    en: 'This app succeeds the original Aquatubos (Unity, 2021), developed as an undergraduate thesis project.',
  },
  originLink: { pt: 'Repositório do aplicativo original', en: 'Repository of the original app' },
  basisHeading: { pt: 'Base de engenharia', en: 'Engineering basis' },
  basis: [
    {
      pt: 'Critérios de verificação da ABNT NBR 12218:2017.',
      en: 'Checks from ABNT NBR 12218:2017.',
    },
    {
      pt: 'Perda de carga por Hazen-Williams e Darcy-Weisbach.',
      en: 'Head loss by Hazen-Williams and Darcy-Weisbach.',
    },
    {
      pt: 'Rede resolvida pelo método do gradiente global, validado contra o EPANET.',
      en: 'Network solved with the Global Gradient Algorithm, validated against EPANET.',
    },
    {
      pt: 'Hardy Cross apresentado passo a passo, para ensino.',
      en: 'Hardy Cross shown step by step, for teaching.',
    },
    {
      pt: 'Os preços dos tubos são ilustrativos.',
      en: 'Pipe prices are illustrative.',
    },
  ],
  sourceHeading: { pt: 'Código-fonte e licença', en: 'Source code and licence' },
  source: {
    pt: 'Software livre sob a licença MIT.',
    en: 'Free software under the MIT licence.',
  },
  sourceLink: { pt: 'Código-fonte no GitHub', en: 'Source code on GitHub' },
  newTab: { pt: '(abre em nova aba)', en: '(opens in a new tab)' },
  disclaimer: {
    pt: 'O Aquatubos é uma ferramenta de ensino, não um software de projeto. Não use os resultados em projetos reais.',
    en: 'Aquatubos is a teaching tool, not design software. Do not use its results in real designs.',
  },
} as const;
