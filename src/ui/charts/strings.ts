import type { LocalizedText } from '../../engine/types';

/** Texts shared by the result views (table, profile, Hardy Cross, pump chart). */
export const resultStrings = {
  solving: { pt: 'Calculando…', en: 'Calculating…' },
  noResult: {
    pt: 'Ainda não há resultados. Use “Calcular / Verificar” para calcular a rede.',
    en: 'There are no results yet. Use “Calculate / Verify” to solve the network.',
  },
  stale: {
    pt: 'Valores desatualizados: são do último cálculo e o projeto mudou depois dele. Use “Calcular / Verificar” para atualizar.',
    en: 'Outdated values: they come from the last calculation and the design changed after it. Use “Calculate / Verify” to update.',
  },
} satisfies Record<string, LocalizedText>;
