import type { LocalizedText } from '../../engine/types';

export interface GlossaryEntry {
  /** Name of the term, with the usual symbol when there is one. */
  term: LocalizedText;
  definition: LocalizedText;
}

/** Technical terms explained by `<Term id="…">` and listed in the glossary dialog. */
export const GLOSSARY = {
  flow: {
    term: { pt: 'Vazão (Q)', en: 'Flow rate (Q)' },
    definition: {
      pt: 'Volume de água que atravessa uma seção do tubo por unidade de tempo. Aqui é mostrada em L/s (1 L/s = 0,001 m³/s).',
      en: 'Volume of water crossing a pipe section per unit of time. Shown here in L/s (1 L/s = 0.001 m³/s).',
    },
  },
  headLoss: {
    term: { pt: 'Perda de carga (hf)', en: 'Head loss (hf)' },
    definition: {
      pt: 'Energia por unidade de peso que a água perde por atrito ao escoar no tubo, em metros de coluna d’água. Cresce com a vazão e o comprimento e diminui quando o diâmetro aumenta.',
      en: 'Energy per unit weight that water loses to friction along the pipe, in metres of water column. It grows with flow and length and drops when the diameter increases.',
    },
  },
  unitHeadLoss: {
    term: { pt: 'Perda de carga unitária (J)', en: 'Unit head loss (J)' },
    definition: {
      pt: 'Perda de carga dividida pelo comprimento do trecho: J = hf / L, em m/m. É a declividade da linha piezométrica no trecho.',
      en: 'Head loss divided by the pipe length: J = hf / L, in m/m. It is the slope of the hydraulic grade line along the pipe.',
    },
  },
  hgl: {
    term: { pt: 'Cota piezométrica', en: 'Hydraulic grade (piezometric head)' },
    definition: {
      pt: 'Soma da cota do terreno com a altura de pressão no ponto (z + p/γ), em m. É o nível que a água atingiria em um tubo aberto ligado à rede naquele ponto.',
      en: 'Ground elevation plus the pressure head at the point (z + p/γ), in m. It is the level water would reach in an open tube connected to the network at that point.',
    },
  },
  hglLine: {
    term: { pt: 'Linha piezométrica', en: 'Hydraulic grade line (HGL)' },
    definition: {
      pt: 'Linha que une as cotas piezométricas ao longo da tubulação. Desce no sentido do escoamento por causa da perda de carga e sobe ao passar por uma bomba.',
      en: 'Line joining the hydraulic grades along the pipeline. It falls in the flow direction because of head loss and rises across a pump.',
    },
  },
  dynamicPressure: {
    term: { pt: 'Pressão dinâmica', en: 'Dynamic pressure' },
    definition: {
      pt: 'Pressão disponível no nó com a rede em funcionamento, isto é, com as demandas sendo atendidas: cota piezométrica menos cota do terreno. O mínimo adotado é 10 mca (100 kPa).',
      en: 'Pressure available at the node with the network in operation, that is, while demands are supplied: hydraulic grade minus ground elevation. The minimum adopted is 10 m of water column (100 kPa).',
    },
  },
  staticPressure: {
    term: { pt: 'Pressão estática', en: 'Static pressure' },
    definition: {
      pt: 'Pressão no nó com a rede sem consumo, quando não há perda de carga: nível d’água do reservatório menos cota do terreno. O máximo adotado é 40 mca (400 kPa).',
      en: 'Pressure at the node with no consumption, when there is no head loss: reservoir water level minus ground elevation. The maximum adopted is 40 m of water column (400 kPa).',
    },
  },
  mca: {
    term: { pt: 'mca (metro de coluna d’água)', en: 'mca (metre of water column)' },
    definition: {
      pt: 'Unidade de pressão expressa como altura de água. 1 mca ≈ 9,81 kPa; 10 mca ≈ 98,1 kPa ≈ 1 kgf/cm².',
      en: 'Pressure unit expressed as a height of water (mH₂O). 1 mca ≈ 9.81 kPa; 10 mca ≈ 98.1 kPa ≈ 1 kgf/cm².',
    },
  },
  dn: {
    term: { pt: 'DN (diâmetro nominal)', en: 'DN (nominal diameter)' },
    definition: {
      pt: 'Número que identifica o tamanho comercial do tubo, em mm. Não coincide necessariamente com o diâmetro interno real; neste aplicativo o cálculo adota o diâmetro interno igual ao DN.',
      en: 'Number that identifies the commercial pipe size, in mm. It does not necessarily match the real internal diameter; in this app the calculation takes the internal diameter equal to the DN.',
    },
  },
  hazenWilliamsC: {
    term: { pt: 'Coeficiente C de Hazen-Williams', en: 'Hazen-Williams coefficient C' },
    definition: {
      pt: 'Coeficiente empírico da fórmula de Hazen-Williams que depende do material e do estado do tubo. Quanto maior o C, mais lisa a parede e menor a perda de carga (PVC: cerca de 140 a 150).',
      en: 'Empirical coefficient of the Hazen-Williams formula that depends on the pipe material and condition. The higher the C, the smoother the wall and the lower the head loss (PVC: about 140 to 150).',
    },
  },
  roughness: {
    term: { pt: 'Rugosidade absoluta (ε)', en: 'Absolute roughness (ε)' },
    definition: {
      pt: 'Altura média das irregularidades da parede interna do tubo, em mm. Entra na fórmula de Darcy-Weisbach por meio da rugosidade relativa ε/D.',
      en: 'Average height of the irregularities of the inner pipe wall, in mm. It enters the Darcy-Weisbach formula through the relative roughness ε/D.',
    },
  },
  frictionFactor: {
    term: { pt: 'Fator de atrito (f)', en: 'Friction factor (f)' },
    definition: {
      pt: 'Coeficiente adimensional da fórmula de Darcy-Weisbach, hf = f · (L/D) · V²/(2g). Depende do número de Reynolds e da rugosidade relativa (equação de Colebrook-White, diagrama de Moody).',
      en: 'Dimensionless coefficient of the Darcy-Weisbach formula, hf = f · (L/D) · V²/(2g). It depends on the Reynolds number and the relative roughness (Colebrook-White equation, Moody chart).',
    },
  },
  reynolds: {
    term: { pt: 'Número de Reynolds (Re)', en: 'Reynolds number (Re)' },
    definition: {
      pt: 'Re = V · D / ν, relação entre forças de inércia e viscosas. Abaixo de cerca de 2000 o escoamento em tubos é laminar; acima de cerca de 4000 é turbulento.',
      en: 'Re = V · D / ν, the ratio of inertial to viscous forces. Below about 2000 pipe flow is laminar; above about 4000 it is turbulent.',
    },
  },
  branchedNetwork: {
    term: { pt: 'Rede ramificada', en: 'Branched network' },
    definition: {
      pt: 'Rede em forma de árvore: a água tem um único caminho do reservatório até cada nó, e a vazão de cada trecho é a soma das demandas a jusante.',
      en: 'Tree-shaped network: water has a single path from the reservoir to each node, and the flow in each pipe is the sum of the downstream demands.',
    },
  },
  loopedNetwork: {
    term: { pt: 'Rede malhada', en: 'Looped network' },
    definition: {
      pt: 'Rede com circuitos fechados (anéis): a água pode chegar a um nó por mais de um caminho. As vazões dependem das perdas de carga e são obtidas por cálculo iterativo.',
      en: 'Network with closed circuits (loops): water can reach a node through more than one path. Flows depend on the head losses and are found by iterative calculation.',
    },
  },
  loop: {
    term: { pt: 'Anel', en: 'Loop' },
    definition: {
      pt: 'Circuito fechado de trechos em uma rede malhada. Percorrendo o anel em um sentido, a soma algébrica das perdas de carga é zero.',
      en: 'Closed circuit of pipes in a looped network. Going around the loop in one direction, the algebraic sum of the head losses is zero.',
    },
  },
  hardyCross: {
    term: { pt: 'Método de Hardy Cross', en: 'Hardy Cross method' },
    definition: {
      pt: 'Método iterativo para redes malhadas. Parte de vazões que respeitam a continuidade nos nós e corrige cada anel com ΔQ = −Σhf / Σ(n · hf/Q) até que Σhf seja praticamente zero (n = 1,852 em Hazen-Williams e 2 em Darcy-Weisbach).',
      en: 'Iterative method for looped networks. It starts from flows that satisfy continuity at the nodes and corrects each loop with ΔQ = −Σhf / Σ(n · hf/Q) until Σhf is practically zero (n = 1.852 for Hazen-Williams and 2 for Darcy-Weisbach).',
    },
  },
  pumpCurve: {
    term: { pt: 'Curva da bomba', en: 'Pump curve' },
    definition: {
      pt: 'Relação entre a altura manométrica que a bomba fornece e a vazão bombeada. Em bombas centrífugas a altura diminui quando a vazão aumenta.',
      en: 'Relation between the head the pump delivers and the pumped flow. In centrifugal pumps the head decreases as the flow increases.',
    },
  },
  systemCurve: {
    term: { pt: 'Curva do sistema', en: 'System curve' },
    definition: {
      pt: 'Altura manométrica que o sistema exige em função da vazão: o desnível e a pressão a vencer mais as perdas de carga, que crescem com a vazão.',
      en: 'Head the system requires as a function of flow: the elevation difference and pressure to overcome plus the head losses, which grow with flow.',
    },
  },
  operatingPoint: {
    term: { pt: 'Ponto de operação', en: 'Operating point' },
    definition: {
      pt: 'Vazão e altura manométrica em que a bomba realmente trabalha. Com um reservatório de chegada, é a interseção da curva da bomba com a curva do sistema. Nesta rede, em que as demandas dos nós fixam a vazão, é o ponto da curva da bomba nessa vazão, e a rede atende quando ele fica acima da curva do sistema.',
      en: 'Flow and head at which the pump actually runs. When pumping to a tank, it is the intersection of the pump curve and the system curve. In this network, where node demands fix the flow, it is the point of the pump curve at that flow, and the network works when it lies above the system curve.',
    },
  },
  k1: {
    term: { pt: 'K1 (dia de maior consumo)', en: 'K1 (maximum day factor)' },
    definition: {
      pt: 'Razão entre o consumo do dia de maior consumo do ano e o consumo médio diário. Valor usual: 1,2.',
      en: 'Ratio of the consumption on the day of highest demand in the year to the average daily consumption. Usual value: 1.2.',
    },
  },
  k2: {
    term: { pt: 'K2 (hora de maior consumo)', en: 'K2 (peak hour factor)' },
    definition: {
      pt: 'Razão entre a vazão da hora de maior consumo e a vazão média do mesmo dia. Valor usual: 1,5. A rede de distribuição é dimensionada com K1 · K2.',
      en: 'Ratio of the flow in the hour of highest demand to the average flow of the same day. Usual value: 1.5. The distribution network is sized with K1 · K2.',
    },
  },
  nbr12218: {
    term: { pt: 'NBR 12218', en: 'NBR 12218' },
    definition: {
      pt: 'Norma da ABNT “Projeto de rede de distribuição de água para abastecimento público”. As verificações de pressão, velocidade e diâmetro mínimo deste aplicativo seguem os critérios dela (edição de 2017).',
      en: 'Brazilian standard (ABNT) “Design of water distribution networks for public supply”. The pressure, velocity and minimum diameter checks in this app follow its criteria (2017 edition).',
    },
  },
} as const satisfies Record<string, GlossaryEntry>;

/** Ids accepted by `<Term id="…">`. */
export type TermId = keyof typeof GLOSSARY;

export const TERM_IDS = Object.keys(GLOSSARY) as TermId[];
