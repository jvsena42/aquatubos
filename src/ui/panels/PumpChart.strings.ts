import type { LocalizedText } from '../../engine/types';

export const pumpStrings = {
  noPump: {
    pt: 'Não há curva de bomba para mostrar: esta rede não é alimentada por uma única bomba ligada ao reservatório.',
    en: 'There is no pump curve to show: this network is not fed by a single pump connected to the reservoir.',
  },
  chartTitle: (id: string): LocalizedText => ({
    pt: `Curva da bomba ${id} e curva do sistema`,
    en: `Curve of pump ${id} and system curve`,
  }),
  axisX: { pt: 'Vazão Q (L/s)', en: 'Flow Q (L/s)' },
  axisY: { pt: 'Altura manométrica H (m)', en: 'Head H (m)' },

  legendPump: { pt: 'Curva da bomba', en: 'Pump curve' },
  legendSystem: { pt: 'Curva do sistema', en: 'System curve' },
  legendCatalogue: { pt: 'Ponto de catálogo', en: 'Catalogue point' },
  legendOperating: { pt: 'Ponto de operação', en: 'Operating point' },
  legendRequired: { pt: 'Altura necessária', en: 'Required head' },
  legendMargin: { pt: 'Folga', en: 'Margin' },
  legendShortfall: { pt: 'Falta de altura', en: 'Head shortfall' },

  marginLabel: (value: string): LocalizedText => ({
    pt: `folga ${value} m`,
    en: `margin ${value} m`,
  }),
  shortfallLabel: (value: string): LocalizedText => ({
    pt: `faltam ${value} m`,
    en: `${value} m short`,
  }),

  readerLabel: { pt: 'Vazão de leitura das curvas', en: 'Flow at which the curves are read' },
  readerHint: {
    pt: 'Toque no gráfico ou passe o cursor sobre ele para ler as duas curvas em uma vazão. Com o teclado, use as setas.',
    en: 'Tap the chart or move the pointer over it to read both curves at a flow. With the keyboard, use the arrow keys.',
  },
  readFlow: { pt: 'Vazão', en: 'Flow' },
  readPump: { pt: 'Bomba', en: 'Pump' },
  readSystem: { pt: 'Sistema', en: 'System' },

  statusOk: { pt: 'A bomba atende', en: 'The pump is sufficient' },
  statusFail: { pt: 'A bomba não atende', en: 'The pump is not sufficient' },
  verdictOk: (flow: string, head: string, required: string, margin: string): LocalizedText => ({
    pt: `Na vazão de ${flow} L/s a bomba fornece ${head} m e a rede precisa de ${required} m. A folga é de ${margin} m: a pressão mínima é mantida em todos os nós.`,
    en: `At ${flow} L/s the pump delivers ${head} m and the network needs ${required} m. The margin is ${margin} m: the minimum pressure is kept at every node.`,
  }),
  verdictFail: (
    flow: string,
    head: string,
    required: string,
    shortfall: string,
    limit: string,
  ): LocalizedText => ({
    pt: `Na vazão de ${flow} L/s a bomba fornece ${head} m, mas a rede precisa de ${required} m. Faltam ${shortfall} m: a bomba não consegue manter a pressão mínima de ${limit}. Aumente os diâmetros para reduzir as perdas de carga e baixar a curva do sistema.`,
    en: `At ${flow} L/s the pump delivers ${head} m, but the network needs ${required} m. It is ${shortfall} m short: the pump cannot keep the minimum pressure of ${limit}. Increase the diameters to reduce the head losses and lower the system curve.`,
  }),

  flow: { pt: 'Vazão na bomba', en: 'Flow through the pump' },
  pumpHead: { pt: 'Altura fornecida pela bomba', en: 'Head delivered by the pump' },
  requiredHead: { pt: 'Altura necessária nessa vazão', en: 'Head required at that flow' },
  margin: { pt: 'Folga (fornecida − necessária)', en: 'Margin (delivered − required)' },

  equationTitle: { pt: 'Curva ajustada', en: 'Fitted curve' },
  equationUnits: { pt: 'com Q em m³/s e H em m', en: 'with Q in m³/s and H in m' },
  cataloguePoints: { pt: 'Pontos de catálogo', en: 'Catalogue points' },

  explanation: (limit: string): LocalizedText => ({
    pt: `Nesta etapa as demandas são fixas, então a vazão da bomba é a soma das demandas e o ponto de operação fica sobre a curva da bomba nessa vazão. A curva do sistema mostra a altura que a bomba precisa fornecer para manter ${limit} no nó mais desfavorável quando a vazão total varia: desnível mais perdas de carga. Tubos maiores baixam essa curva.`,
    en: `In this stage the demands are fixed, so the pump flow is the sum of the demands and the operating point lies on the pump curve at that flow. The system curve shows the head the pump must deliver to keep ${limit} at the worst node as the total flow changes: static lift plus head losses. Larger pipes lower this curve.`,
  }),
  offScale: {
    pt: 'A altura necessária está acima da escala do gráfico.',
    en: 'The required head is above the chart scale.',
  },

  tableCaption: {
    pt: 'Pontos das curvas da bomba e do sistema',
    en: 'Points of the pump and system curves',
  },
  tableFlow: { pt: 'Vazão (L/s)', en: 'Flow (L/s)' },
  tablePump: { pt: 'Altura da bomba (m)', en: 'Pump head (m)' },
  tableSystem: { pt: 'Altura do sistema (m)', en: 'System head (m)' },
} as const;
