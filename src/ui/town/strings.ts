import type { LocalizedText } from '../../engine/types';
import type { ServiceStatus } from '../../game/houses';

export const townStrings = {
  drawing: { pt: 'Mapa da cidade', en: 'Town map' },
  drawingHelp: {
    pt: 'Arraste para mover e use a roda do mouse ou o gesto de pinça para aproximar. Selecione uma rua para alterar o diâmetro do trecho, ou as casas de um nó para ver o cálculo.',
    en: 'Drag to pan and use the mouse wheel or pinch to zoom. Select a street to change the diameter of its pipe, or the houses of a node to see its calculation.',
  },
  houses: (count: number): LocalizedText =>
    count === 0
      ? { pt: 'sem casas', en: 'no houses' }
      : count === 1
        ? { pt: '1 casa', en: '1 house' }
        : { pt: `${count} casas`, en: `${count} houses` },
  elevated: { pt: 'reservatório elevado', en: 'elevated tank' },
  ground: { pt: 'reservatório apoiado', en: 'ground reservoir' },
  pumpHouse: { pt: 'casa de bombas', en: 'pump house' },
  legendServed: { pt: 'Casas atendidas', en: 'Houses served' },
  legendLow: (limit: string): LocalizedText => ({
    pt: `Torneiras secas: dinâmica abaixo de ${limit} mca`,
    en: `Dry taps: dynamic below ${limit} mca`,
  }),
  legendHigh: (limit: string): LocalizedText => ({
    pt: `Risco de rompimento: estática acima de ${limit} mca`,
    en: `Burst risk: static above ${limit} mca`,
  }),
} as const;

/** Service at the houses of a node, as read out for each cluster. */
export const serviceLabels: Record<ServiceStatus, LocalizedText> = {
  unknown: { pt: 'sem resultado', en: 'no result yet' },
  ok: { pt: 'atendido', en: 'served' },
  low: {
    pt: 'pressão dinâmica abaixo da mínima, torneiras secas',
    en: 'dynamic pressure below the minimum, dry taps',
  },
  high: {
    pt: 'pressão estática acima da máxima, risco de rompimento',
    en: 'static pressure above the maximum, burst risk',
  },
};
