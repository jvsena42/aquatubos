import type { CheckSeverity, LocalizedText } from '../../engine/types';

export const resultsStrings = {
  pipesTitle: { pt: 'Trechos', en: 'Pipes' },
  pipesCaption: {
    pt: 'Planilha de cálculo por trecho. Montante e jusante seguem o sentido real do escoamento.',
    en: 'Calculation sheet by pipe. Upstream and downstream follow the actual flow direction.',
  },
  nodesTitle: { pt: 'Nós', en: 'Nodes' },
  nodesCaption: {
    pt: 'Cotas e pressões por nó.',
    en: 'Elevations and pressures by node.',
  },
  exportCsv: { pt: 'Exportar CSV', en: 'Export CSV' },
  selectHint: {
    pt: 'Clique em uma linha para selecionar o trecho ou o nó na rede.',
    en: 'Click a row to select the pipe or node in the network.',
  },

  pipe: { pt: 'Trecho', en: 'Pipe' },
  node: { pt: 'Nó', en: 'Node' },
  upstream: { pt: 'Montante', en: 'Upstream' },
  downstream: { pt: 'Jusante', en: 'Downstream' },
  length: { pt: 'Extensão', en: 'Length' },
  flow: { pt: 'Vazão', en: 'Flow' },
  velocity: { pt: 'Velocidade', en: 'Velocity' },
  unitHeadLoss: { pt: 'Perda unitária J', en: 'Unit loss J' },
  headLoss: { pt: 'Perda de carga', en: 'Head loss' },
  hgl: { pt: 'Cota piezométrica', en: 'Hydraulic grade' },
  elevation: { pt: 'Cota do terreno', en: 'Ground elevation' },
  pressure: { pt: 'Pressão disponível', en: 'Available pressure' },
  demand: { pt: 'Demanda', en: 'Demand' },
  dynamicPressure: { pt: 'Pressão dinâmica', en: 'Dynamic pressure' },
  staticPressure: { pt: 'Pressão estática', en: 'Static pressure' },
  reservoir: { pt: 'reservatório', en: 'reservoir' },

  reversed: (from: string, to: string): LocalizedText => ({
    pt: `Sentido invertido: a água escoa de ${from} para ${to}, contra o sentido em que o trecho foi desenhado.`,
    en: `Reversed: water flows from ${from} to ${to}, against the direction the pipe was drawn.`,
  }),
  belowLimit: (limit: string): LocalizedText => ({
    pt: `abaixo do mínimo de ${limit}`,
    en: `below the minimum of ${limit}`,
  }),
  aboveLimit: (limit: string): LocalizedText => ({
    pt: `acima do máximo de ${limit}`,
    en: `above the maximum of ${limit}`,
  }),
  legendError: {
    pt: 'fora do limite (impede a aprovação)',
    en: 'outside the limit (blocks approval)',
  },
  legendWarning: {
    pt: 'fora do limite recomendado (aviso)',
    en: 'outside the recommended limit (warning)',
  },
  legendReversed: {
    pt: 'escoamento contrário ao sentido desenhado',
    en: 'flow against the drawn direction',
  },
} satisfies Record<string, LocalizedText | ((...args: string[]) => LocalizedText)>;

export const flagSeverityLabels: Record<CheckSeverity, LocalizedText> = {
  error: { pt: 'Erro', en: 'Error' },
  warning: { pt: 'Aviso', en: 'Warning' },
};
