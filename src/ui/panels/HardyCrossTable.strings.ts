import type { LocalizedText } from '../../engine/types';

export const hardyCrossStrings = {
  noLoops: {
    pt: 'O método de Hardy Cross equilibra as perdas de carga em anéis. Esta rede não tem anéis (é ramificada): a vazão de cada trecho já fica definida pela soma das demandas a jusante, sem iterações.',
    en: 'The Hardy Cross method balances head losses around loops. This network has no loops (it is branched): the flow of each pipe is already set by the sum of the downstream demands, with no iterations.',
  },
  introBefore: {
    pt: 'Em cada iteração, calcula-se para cada ',
    en: 'In each iteration, for each ',
  },
  introLoop: { pt: 'anel', en: 'loop' },
  introAfter: {
    pt: ' a soma das perdas de carga no sentido horário (Σh) e soma-se à vazão dos seus trechos a correção:',
    en: ' the head losses are added up clockwise (Σh) and the flow of its pipes receives the correction:',
  },
  exponent: (n: string, formula: string): LocalizedText => ({
    pt: `n = ${n} (${formula}). As iterações param quando Σh é praticamente zero em todos os anéis.`,
    en: `n = ${n} (${formula}). The iterations stop when Σh is practically zero in every loop.`,
  }),
  method: { pt: 'Método', en: 'Method' },

  converged: (count: number): LocalizedText => ({
    pt: count === 1 ? 'Convergiu em 1 iteração' : `Convergiu em ${count} iterações`,
    en: count === 1 ? 'Converged in 1 iteration' : `Converged in ${count} iterations`,
  }),
  notConverged: (count: number): LocalizedText => ({
    pt: `Não convergiu em ${count} iterações`,
    en: `Did not converge in ${count} iterations`,
  }),
  tolerance: (value: string): LocalizedText => ({
    pt: `Critério de parada: maior |ΔQ| menor que ${value} L/s.`,
    en: `Stopping rule: largest |ΔQ| below ${value} L/s.`,
  }),

  convergenceTitle: { pt: 'Maior |ΔQ| por iteração (L/s)', en: 'Largest |ΔQ| per iteration (L/s)' },
  goTo: (iteration: number): LocalizedText => ({
    pt: `Ir para a iteração ${iteration}`,
    en: `Go to iteration ${iteration}`,
  }),

  stepper: { pt: 'Iteração mostrada', en: 'Iteration shown' },
  first: { pt: 'Primeira iteração', en: 'First iteration' },
  previous: { pt: 'Iteração anterior', en: 'Previous iteration' },
  next: { pt: 'Próxima iteração', en: 'Next iteration' },
  last: { pt: 'Última iteração', en: 'Last iteration' },
  iterationOf: (iteration: number, total: number): LocalizedText => ({
    pt: `Iteração ${iteration} de ${total}`,
    en: `Iteration ${iteration} of ${total}`,
  }),
  iteration: (iteration: number): LocalizedText => ({
    pt: `Iteração ${iteration}`,
    en: `Iteration ${iteration}`,
  }),
  showAll: { pt: 'Mostrar todas as iterações', en: 'Show all iterations' },
  maxDelta: (value: string): LocalizedText => ({
    pt: `maior |ΔQ| = ${value} L/s`,
    en: `largest |ΔQ| = ${value} L/s`,
  }),

  loop: (id: string): LocalizedText => ({ pt: `Anel ${id}`, en: `Loop ${id}` }),
  loopCaption: (id: string, iteration: number): LocalizedText => ({
    pt: `Anel ${id}, iteração ${iteration}`,
    en: `Loop ${id}, iteration ${iteration}`,
  }),
  pipe: { pt: 'Trecho', en: 'Pipe' },
  direction: { pt: 'Sentido', en: 'Direction' },
  directionWith: { pt: 'no sentido do anel', en: 'along the loop direction' },
  directionAgainst: { pt: 'contra o sentido do anel', en: 'against the loop direction' },
  flow: { pt: 'Q', en: 'Q' },
  headLoss: { pt: 'h', en: 'h' },
  corrected: { pt: 'Q corrigida', en: 'Corrected Q' },
  alsoIn: (loops: string): LocalizedText => ({
    pt: `também no anel ${loops}`,
    en: `also in loop ${loops}`,
  }),
  sum: { pt: 'Soma', en: 'Sum' },

  signsTitle: { pt: 'Sinais', en: 'Signs' },
  signs: {
    pt: 'O sentido do anel é o horário. “+” indica que o trecho foi desenhado nesse sentido e “−” que foi desenhado no sentido contrário. Q e h aparecem com sinal em relação ao sentido do anel: positivos quando a água percorre o trecho no sentido horário. Um trecho comum a dois anéis recebe as duas correções na mesma iteração, cada uma com o sinal do trecho no respectivo anel; por isso a sua Q corrigida pode diferir de Q + ΔQ.',
    en: 'The loop direction is clockwise. “+” means the pipe was drawn in that direction and “−” that it was drawn the opposite way. Q and h are signed relative to the loop direction: positive when water runs clockwise through the pipe. A pipe shared by two loops receives both corrections in the same iteration, each with the sign of the pipe in the respective loop; that is why its corrected Q can differ from Q + ΔQ.',
  },

  compareTitle: {
    pt: 'Vazões finais: Hardy Cross e solver',
    en: 'Final flows: Hardy Cross and solver',
  },
  compareNote: {
    pt: 'Vazões no sentido em que cada trecho foi desenhado (negativa = sentido contrário). O solver usa o método do gradiente global, que resolve todas as equações de uma vez.',
    en: 'Flows in the direction each pipe was drawn (negative = opposite direction). The solver uses the global gradient method, which solves all the equations at once.',
  },
  initial: { pt: 'Q inicial', en: 'Initial Q' },
  hardyCross: { pt: 'Q Hardy Cross', en: 'Hardy Cross Q' },
  solver: { pt: 'Q solver', en: 'Solver Q' },
  difference: { pt: 'Diferença', en: 'Difference' },
  maxDifference: (value: string): LocalizedText => ({
    pt: `Maior diferença entre os dois métodos: ${value} L/s.`,
    en: `Largest difference between the two methods: ${value} L/s.`,
  }),
} as const;
