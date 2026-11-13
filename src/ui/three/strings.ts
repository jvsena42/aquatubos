import type { LocalizedText } from '../../engine/types';
import type { Status } from './status';

/** Pressure head unit, as in the checks. */
export const HEAD_UNIT: LocalizedText = { pt: 'mca', en: 'mca' };

export const strings3d = {
  canvasLabel: (stage: string, withResult: boolean): LocalizedText => ({
    pt: withResult
      ? `Vista 3D da rede de ${stage}: terreno, tubos, nós coloridos pela pressão, reservatório e superfície da linha piezométrica acima do terreno.`
      : `Vista 3D da rede de ${stage}: terreno, tubos, nós e reservatório.`,
    en: withResult
      ? `3D view of the ${stage} network: terrain, pipes, nodes coloured by pressure, reservoir and the hydraulic grade line surface above the terrain.`
      : `3D view of the ${stage} network: terrain, pipes, nodes and reservoir.`,
  }),
  controls: { pt: 'Controles da vista 3D', en: '3D view controls' },
  exaggeration: { pt: 'Exagero vertical', en: 'Vertical exaggeration' },
  /** Shown next to the 1× 5× 10× buttons. */
  exaggerationShort: { pt: 'Vertical', en: 'Vertical' },
  exaggerationOption: (factor: number): LocalizedText => ({
    pt: `Exagero vertical de ${factor}×`,
    en: `Vertical exaggeration ${factor}×`,
  }),
  scaleNote: (factor: number): LocalizedText =>
    factor === 1
      ? { pt: 'Alturas em escala real (1×)', en: 'Heights at true scale (1×)' }
      : { pt: `Alturas ampliadas ${factor}×`, en: `Heights exaggerated ${factor}×` },
  resetView: { pt: 'Recentrar vista', en: 'Reset view' },
  resetShort: { pt: 'Recentrar', en: 'Reset' },
  hgl: { pt: 'Linha piezométrica', en: 'Hydraulic grade line' },
  hglShort: { pt: 'Piezométrica', en: 'HGL' },
  helpTopic: { pt: 'Vista 3D', en: '3D view' },
  labels: { pt: 'Rótulos', en: 'Labels' },
  hint: {
    pt: 'Arraste para girar. Role ou afaste dois dedos para aproximar. O botão direito ou dois dedos arrastando deslocam a vista. Clique em um tubo ou nó para selecionar.',
    en: 'Drag to rotate. Scroll or pinch to zoom. The right button or a two-finger drag pans the view. Click a pipe or node to select it.',
  },
  hintTouch: {
    pt: 'Arraste com um dedo para girar. Afaste ou junte dois dedos para aproximar ou afastar e arraste com dois dedos para deslocar a vista. Toque em um tubo, nó ou reservatório para selecionar e ver o rótulo completo.',
    en: 'Drag with one finger to rotate. Pinch with two fingers to zoom and drag with two fingers to pan the view. Tap a pipe, node or reservoir to select it and see its full label.',
  },
  staleShort: { pt: 'Desatualizado', en: 'Outdated' },
  stale: {
    pt: 'Resultados desatualizados: as pressões e a linha piezométrica são do último cálculo. Calcule novamente.',
    en: 'Results are outdated: pressures and the hydraulic grade line are from the last calculation. Calculate again.',
  },
  noResult: {
    pt: 'Ainda não há resultado. Calcule para ver as pressões e a linha piezométrica.',
    en: 'There is no result yet. Calculate to see pressures and the hydraulic grade line.',
  },
  noResultShort: { pt: 'Sem cálculo', en: 'Not calculated' },
  summaryShort: (node: string, pressure: string, minimum: string, ok: boolean): LocalizedText => ({
    pt: ok
      ? `Crítico: ${node} · ${pressure} mca`
      : `Crítico: ${node} · ${pressure} mca < ${minimum} mca`,
    en: ok
      ? `Critical: ${node} · ${pressure} mca`
      : `Critical: ${node} · ${pressure} mca < ${minimum} mca`,
  }),
  noWebgl: {
    pt: 'Este navegador não conseguiu iniciar o WebGL, por isso a vista 3D não pode ser mostrada. As outras abas mostram os mesmos resultados.',
    en: 'This browser could not start WebGL, so the 3D view cannot be shown. The other tabs show the same results.',
  },
  summary: (node: string, pressure: string, minimum: string, ok: boolean): LocalizedText => ({
    pt: ok
      ? `Nó crítico: ${node}, com pressão dinâmica de ${pressure} mca (mínimo de ${minimum} mca).`
      : `Nó crítico: ${node}, com pressão dinâmica de ${pressure} mca, abaixo do mínimo de ${minimum} mca.`,
    en: ok
      ? `Critical node: ${node}, with a dynamic pressure of ${pressure} mca (minimum ${minimum} mca).`
      : `Critical node: ${node}, with a dynamic pressure of ${pressure} mca, below the minimum of ${minimum} mca.`,
  }),
  legend: { pt: 'Legenda', en: 'Legend' },
  nodePressure: { pt: 'Nós, pressão:', en: 'Nodes, pressure:' },
  pipeVelocity: { pt: 'Tubos, velocidade:', en: 'Pipes, velocity:' },
  hglSurface: { pt: 'Linha piezométrica', en: 'Hydraulic grade line' },
  pump: { pt: 'Bomba', en: 'Pump' },
} as const;

export const statusLabels: Record<Exclude<Status, 'none'>, LocalizedText> = {
  low: { pt: 'baixa', en: 'low' },
  ok: { pt: 'adequada', en: 'ok' },
  high: { pt: 'alta', en: 'high' },
};
