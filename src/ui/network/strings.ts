import type { LocalizedText } from '../../engine/types';
import type { LimitStatus } from './status';

/** Pressure head unit, used in both languages like in the stage texts. */
export const HEAD_UNIT = 'mca';

export const networkStrings = {
  drawing: { pt: 'Desenho da rede', en: 'Network drawing' },
  drawingHelp: {
    pt: 'Arraste para mover e use a roda do mouse ou o gesto de pinça para aproximar. Selecione um trecho ou nó para ver o cálculo.',
    en: 'Drag to pan and use the mouse wheel or pinch to zoom. Select a pipe or node to see its calculation.',
  },
  selectHint: {
    pt: 'Selecione um trecho para alterar o diâmetro.',
    en: 'Select a pipe to change its diameter.',
  },
  zoomIn: { pt: 'Aproximar', en: 'Zoom in' },
  zoomOut: { pt: 'Afastar', en: 'Zoom out' },
  fit: { pt: 'Enquadrar a rede', en: 'Fit network' },
  zoomControls: { pt: 'Controles de zoom', en: 'Zoom controls' },
  staleHint: {
    pt: 'Resultados do cálculo anterior. Calcule novamente.',
    en: 'Results of the previous calculation. Calculate again.',
  },
  notSolvedHint: {
    pt: 'Calcule para ver pressões, vazões e velocidades.',
    en: 'Calculate to see pressures, flows and velocities.',
  },
  outdated: { pt: 'resultados desatualizados', en: 'outdated results' },
  pipe: (id: string): LocalizedText => ({ pt: `Trecho ${id}`, en: `Pipe ${id}` }),
  node: (id: string): LocalizedText => ({ pt: `Nó ${id}`, en: `Node ${id}` }),
  reservoir: (id: string): LocalizedText => ({ pt: `Reservatório ${id}`, en: `Reservoir ${id}` }),
  pump: (id: string): LocalizedText => ({ pt: `Bomba ${id}`, en: `Pump ${id}` }),
  flow: { pt: 'vazão', en: 'flow' },
  velocity: { pt: 'velocidade', en: 'velocity' },
  pressure: { pt: 'pressão', en: 'pressure' },
  demand: { pt: 'demanda', en: 'demand' },
  head: { pt: 'altura manométrica', en: 'head' },
  waterLevel: { pt: "nível d'água", en: 'water level' },
  /** Abbreviation of "nível d'água" drawn next to the reservoir. */
  waterLevelShort: { pt: 'NA', en: 'WL' },
  flowFromTo: (from: string, to: string): LocalizedText => ({
    pt: `escoamento de ${from} para ${to}`,
    en: `flowing from ${from} to ${to}`,
  }),
  noFlow: { pt: 'sem escoamento', en: 'no flow' },
  fixedDiameter: { pt: 'diâmetro fixo', en: 'fixed diameter' },
  lowVelocityMark: { pt: 'V baixa', en: 'low V' },
  highVelocityMark: { pt: 'V alta', en: 'high V' },
  legend: { pt: 'Legenda', en: 'Legend' },
  legendPressureOk: { pt: 'Pressão adequada', en: 'Pressure within limits' },
  legendPressureLow: (limit: string): LocalizedText => ({
    pt: `Dinâmica abaixo de ${limit} ${HEAD_UNIT}`,
    en: `Dynamic below ${limit} ${HEAD_UNIT}`,
  }),
  legendPressureHigh: (limit: string): LocalizedText => ({
    pt: `Estática acima de ${limit} ${HEAD_UNIT}`,
    en: `Static above ${limit} ${HEAD_UNIT}`,
  }),
  legendVelocityLow: (limit: string): LocalizedText => ({
    pt: `V abaixo de ${limit} m/s`,
    en: `V below ${limit} m/s`,
  }),
  legendVelocityOk: (min: string, max: string): LocalizedText => ({
    pt: `V de ${min} a ${max} m/s`,
    en: `V from ${min} to ${max} m/s`,
  }),
  legendVelocityOkOnly: { pt: 'V adequada', en: 'V within the limit' },
  legendVelocityHigh: (limit: string): LocalizedText => ({
    pt: `V acima de ${limit} m/s`,
    en: `V above ${limit} m/s`,
  }),
  legendDirection: { pt: 'Sentido do escoamento', en: 'Flow direction' },
  legendWidth: { pt: 'Espessura proporcional ao DN', en: 'Line width follows the DN' },
  dnGroup: (id: string): LocalizedText => ({
    pt: `Diâmetro nominal do trecho ${id}`,
    en: `Nominal diameter of pipe ${id}`,
  }),
  dnOption: (dn: number, price: string): LocalizedText => ({
    pt: `DN ${dn}, ${price} por metro`,
    en: `DN ${dn}, ${price} per metre`,
  }),
  perMetre: { pt: '/m', en: '/m' },
  fixedPipe: {
    pt: 'O diâmetro deste trecho é fixo nesta etapa e não pode ser alterado.',
    en: 'The diameter of this pipe is fixed in this stage and cannot be changed.',
  },
} as const;

export const pressureStatusLabels: Record<LimitStatus, LocalizedText> = {
  none: { pt: 'pressão não verificada', en: 'pressure not checked' },
  ok: { pt: 'pressão dentro dos limites', en: 'pressure within limits' },
  low: { pt: 'pressão dinâmica abaixo da mínima', en: 'dynamic pressure below the minimum' },
  high: { pt: 'pressão estática acima da máxima', en: 'static pressure above the maximum' },
};

export const velocityStatusLabels: Record<LimitStatus, LocalizedText> = {
  none: { pt: 'velocidade não verificada', en: 'velocity not checked' },
  ok: { pt: 'velocidade dentro dos limites', en: 'velocity within limits' },
  low: { pt: 'velocidade abaixo da mínima', en: 'velocity below the minimum' },
  high: { pt: 'velocidade acima da máxima', en: 'velocity above the maximum' },
};
