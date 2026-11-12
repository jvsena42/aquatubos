import type { LocalizedText } from '../../engine/types';

export const profileStrings = {
  endNode: { pt: 'Perfil até o nó', en: 'Profile to node' },
  chartTitle: (from: string, to: string): LocalizedText => ({
    pt: `Perfil longitudinal de ${from} a ${to}`,
    en: `Longitudinal profile from ${from} to ${to}`,
  }),
  summary: (path: string, length: string, node: string, pressure: string): LocalizedText => ({
    pt: `Caminho ${path}, ${length} m. Menor pressão no caminho: ${pressure} no nó ${node}.`,
    en: `Path ${path}, ${length} m. Lowest pressure on the path: ${pressure} at node ${node}.`,
  }),
  belowCount: (count: number, limit: string): LocalizedText => ({
    pt:
      count === 1
        ? `1 nó do caminho está abaixo do mínimo de ${limit}.`
        : `${count} nós do caminho estão abaixo do mínimo de ${limit}.`,
    en:
      count === 1
        ? `1 node on the path is below the minimum of ${limit}.`
        : `${count} nodes on the path are below the minimum of ${limit}.`,
  }),
  clipped: {
    pt: 'A linha piezométrica desce além da escala do gráfico (pressões negativas); os valores estão nos rótulos.',
    en: 'The hydraulic grade line falls below the chart scale (negative pressures); the values are in the labels.',
  },
  noPath: {
    pt: 'Não há caminho do reservatório até este nó.',
    en: 'There is no path from the reservoir to this node.',
  },

  axisX: { pt: 'Distância acumulada (m)', en: 'Accumulated distance (m)' },
  axisY: { pt: 'Cota (m)', en: 'Elevation (m)' },

  legendHgl: { pt: 'Linha piezométrica', en: 'Hydraulic grade line' },
  legendStatic: { pt: 'Nível estático', en: 'Static level' },
  legendMin: (limit: string): LocalizedText => ({
    pt: `Terreno + ${limit} (pressão mínima)`,
    en: `Ground + ${limit} (minimum pressure)`,
  }),
  legendTerrain: { pt: 'Terreno', en: 'Ground' },
  legendPipe: { pt: 'Tubulação', en: 'Pipe' },
  legendNode: { pt: 'Nó', en: 'Node' },
  legendBelow: { pt: 'Nó abaixo da pressão mínima', en: 'Node below the minimum pressure' },

  pumpLabel: (id: string, head: string): LocalizedText => ({
    pt: `Bomba ${id}: +${head} m`,
    en: `Pump ${id}: +${head} m`,
  }),
  hint: {
    pt: 'Passe o cursor ou toque em um nó para ver os valores. Clicar seleciona o nó na rede.',
    en: 'Hover or tap a node to see its values. Clicking selects the node in the network.',
  },

  node: { pt: 'Nó', en: 'Node' },
  reservoir: { pt: 'Reservatório', en: 'Reservoir' },
  distance: { pt: 'Distância', en: 'Distance' },
  elevation: { pt: 'Cota do terreno', en: 'Ground elevation' },
  hgl: { pt: 'Cota piezométrica', en: 'Hydraulic grade' },
  pressure: { pt: 'Pressão', en: 'Pressure' },
  staticHead: { pt: 'Nível estático', en: 'Static level' },
  belowMin: { pt: 'abaixo do mínimo', en: 'below the minimum' },
  tableCaption: { pt: 'Dados do perfil por nó', en: 'Profile data by node' },
} as const;
