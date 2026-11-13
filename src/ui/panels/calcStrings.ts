import type { LocalizedText } from '../../engine/types';
import type { FlowRegime } from './calcModel';

export const calcStrings = {
  summary: { pt: 'Resumo da rede', en: 'Network summary' },
  totalDemand: { pt: 'Demanda total', en: 'Total demand' },
  pipeCount: { pt: 'Trechos', en: 'Pipes' },
  totalLength: { pt: 'Comprimento total', en: 'Total length' },
  currentCost: { pt: 'Custo atual', en: 'Current cost' },
  clear: { pt: 'Limpar seleção', en: 'Clear selection' },
  needsCalculation: { pt: 'Recalcular', en: 'Recalculate' },
  showCalculation: { pt: 'Ver cálculo', en: 'Show calculation' },
  changeDn: { pt: 'Alterar', en: 'Change' },
  changeDnLabel: (id: string): LocalizedText => ({
    pt: `Alterar o diâmetro do trecho ${id}`,
    en: `Change the diameter of pipe ${id}`,
  }),
  results: { pt: 'Resultados', en: 'Results' },
  costShort: { pt: 'Custo', en: 'Cost' },
  pressure: { pt: 'Pressão', en: 'Pressure' },
  staticShort: { pt: 'Estática', en: 'Static' },
  levelShort: { pt: 'Nível', en: 'Level' },
  flowShort: { pt: 'Vazão', en: 'Flow' },
  headShort: { pt: 'Altura', en: 'Head' },
  solving: { pt: 'Calculando…', en: 'Calculating…' },

  pipe: (id: string): LocalizedText => ({ pt: `Trecho ${id}`, en: `Pipe ${id}` }),
  node: (id: string): LocalizedText => ({ pt: `Nó ${id}`, en: `Node ${id}` }),
  reservoir: (id: string): LocalizedText => ({ pt: `Reservatório ${id}`, en: `Reservoir ${id}` }),
  pump: (id: string): LocalizedText => ({ pt: `Bomba ${id}`, en: `Pump ${id}` }),

  // Pipe
  diameter: { pt: 'Diâmetro', en: 'Diameter' },
  ends: { pt: 'Ligação', en: 'Connects' },
  length: { pt: 'Comprimento', en: 'Length' },
  material: { pt: 'Material', en: 'Material' },
  roughnessHw: { pt: 'Coeficiente C', en: 'Coefficient C' },
  roughnessDw: { pt: 'Rugosidade ε', en: 'Roughness ε' },
  cost: { pt: 'Custo do trecho', en: 'Pipe cost' },
  calculation: { pt: 'Cálculo passo a passo', en: 'Step-by-step calculation' },
  stepFlow: { pt: 'Vazão', en: 'Flow rate' },
  stepArea: { pt: 'Área da seção', en: 'Cross-section area' },
  stepVelocity: { pt: 'Velocidade', en: 'Velocity' },
  stepUnitLoss: { pt: 'Perda de carga unitária', en: 'Unit head loss' },
  stepHeadLoss: { pt: 'Perda de carga', en: 'Head loss' },
  stepReynolds: { pt: 'Número de Reynolds', en: 'Reynolds number' },
  stepRelativeRoughness: { pt: 'Rugosidade relativa', en: 'Relative roughness' },
  stepFriction: { pt: 'Fator de atrito', en: 'Friction factor' },
  stepEnergy: { pt: 'Linha de energia', en: 'Energy line' },
  hgl: { pt: 'cota piezométrica', en: 'hydraulic grade' },
  hglAbbr: { pt: 'CP', en: 'HG' },
  downstream: { pt: 'jusante', en: 'downstream' },
  upstream: { pt: 'montante', en: 'upstream' },
  hazenWilliams: {
    pt: 'Hazen-Williams, Q em m³/s e D em m',
    en: 'Hazen-Williams, Q in m³/s and D in m',
  },
  viscosity: {
    pt: 'ν = viscosidade cinemática da água a 20 °C',
    en: 'ν = kinematic viscosity of water at 20 °C',
  },
  flowDirection: (from: string, to: string): LocalizedText => ({
    pt: `Escoamento de ${from} para ${to}.`,
    en: `Flow from ${from} to ${to}.`,
  }),
  flowReversed: (from: string, to: string): LocalizedText => ({
    pt: `Escoamento de ${from} para ${to}, contrário ao sentido em que o trecho foi cadastrado.`,
    en: `Flow from ${from} to ${to}, against the direction in which the pipe was defined.`,
  }),
  colebrook: {
    pt: 'Colebrook-White, resolvida por iteração',
    en: 'Colebrook-White, solved by iteration',
  },
  laminar: { pt: 'escoamento laminar', en: 'laminar flow' },
  transition: {
    pt: 'faixa de transição: interpolação linear em Re entre o valor laminar e o de Colebrook-White',
    en: 'transition range: linear interpolation in Re between the laminar value and the Colebrook-White one',
  },
  noFlow: { pt: 'Sem escoamento neste trecho.', en: 'No flow in this pipe.' },

  // Limits
  within: (range: string): LocalizedText => ({ pt: `Atende (${range})`, en: `OK (${range})` }),
  belowMin: (limit: string): LocalizedText => ({
    pt: `Abaixo do mínimo de ${limit}`,
    en: `Below the minimum of ${limit}`,
  }),
  aboveMax: (limit: string): LocalizedText => ({
    pt: `Acima do máximo de ${limit}`,
    en: `Above the maximum of ${limit}`,
  }),
  min: (limit: string): LocalizedText => ({ pt: `mín. ${limit}`, en: `min. ${limit}` }),
  max: (limit: string): LocalizedText => ({ pt: `máx. ${limit}`, en: `max. ${limit}` }),
  range: (min: string, max: string): LocalizedText => ({
    pt: `${min} a ${max}`,
    en: `${min} to ${max}`,
  }),
  notRequired: { pt: 'não exigido nesta etapa', en: 'not required in this stage' },

  // Node
  demand: { pt: 'Demanda', en: 'Demand' },
  elevation: { pt: 'Cota do terreno', en: 'Ground elevation' },
  hglFact: { pt: 'Cota piezométrica', en: 'Hydraulic grade' },
  stepDynamic: { pt: 'Pressão dinâmica', en: 'Dynamic pressure' },
  stepStatic: { pt: 'Pressão estática', en: 'Static pressure' },
  stepContinuity: { pt: 'Continuidade no nó', en: 'Continuity at the node' },
  pressureEq: {
    pt: 'pressão = cota piezométrica − cota do terreno',
    en: 'pressure = hydraulic grade − ground elevation',
  },
  staticEq: {
    pt: 'pressão estática = nível estático − cota do terreno',
    en: 'static pressure = static level − ground elevation',
  },
  staticNote: {
    pt: 'Nível estático: nível d’água do reservatório mais alto ligado ao nó, sem escoamento (com bomba, somada a altura de vazão nula).',
    en: 'Static level: water level of the highest reservoir connected to the node, with no flow (with a pump, plus its shutoff head).',
  },
  notChecked: {
    pt: 'Nó de recalque sem consumo: não entra nas verificações de pressão.',
    en: 'Pump discharge node without demand: left out of the pressure checks.',
  },
  link: { pt: 'Ligação', en: 'Link' },
  direction: { pt: 'Sentido', en: 'Direction' },
  entersFrom: (id: string): LocalizedText => ({ pt: `entra, de ${id}`, en: `in, from ${id}` }),
  leavesTo: (id: string): LocalizedText => ({ pt: `sai, para ${id}`, en: `out, to ${id}` }),
  still: { pt: 'sem escoamento', en: 'no flow' },
  continuityEq: {
    pt: 'Σ entra − Σ sai − demanda = 0',
    en: 'Σ in − Σ out − demand = 0',
  },

  // Reservoir
  waterLevel: { pt: 'Nível d’água', en: 'Water level' },
  supplied: { pt: 'Vazão fornecida', en: 'Flow supplied' },
  reservoirNote: {
    pt: 'No reservatório a cota piezométrica é o próprio nível d’água: a pressão na superfície é a atmosférica.',
    en: 'At the reservoir the hydraulic grade is the water level itself: the pressure at the surface is atmospheric.',
  },
  links: { pt: 'Ligações', en: 'Links' },

  // Pump
  pumpEnds: { pt: 'Sucção → recalque', en: 'Suction → discharge' },
  cataloguePoints: { pt: 'Pontos do catálogo', en: 'Catalogue points' },
  stepCurve: { pt: 'Curva da bomba', en: 'Pump curve' },
  curveNote: {
    pt: 'Curva ajustada pelos três pontos do catálogo, com Q em m³/s e H em m.',
    en: 'Curve fitted to the three catalogue points, with Q in m³/s and H in m.',
  },
  stepOperating: { pt: 'Ponto de operação', en: 'Operating point' },
  stepPumpEnergy: { pt: 'Ganho de energia', en: 'Energy gain' },
} as const;

export const regimeLabels: Record<FlowRegime, LocalizedText> = {
  laminar: calcStrings.laminar,
  transition: calcStrings.transition,
  turbulent: calcStrings.colebrook,
};
