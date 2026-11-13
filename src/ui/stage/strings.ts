import type { HeadLossFormula, LocalizedText } from '../../engine/types';

export const stageStrings = {
  stage: (order: number): LocalizedText => ({ pt: `Etapa ${order}`, en: `Stage ${order}` }),
  formula: { pt: 'Fórmula de perda de carga', en: 'Head loss formula' },
  verify: { pt: 'Calcular / Verificar', en: 'Calculate / Verify' },
  solving: { pt: 'Calculando…', en: 'Calculating…' },
  stale: {
    pt: 'O projeto mudou desde o último cálculo. Calcule novamente.',
    en: 'The design changed since the last calculation. Calculate again.',
  },
  reset: { pt: 'Restaurar diâmetros', en: 'Reset diameters' },
  briefing: { pt: 'Enunciado', en: 'Briefing' },
  objectives: { pt: 'Objetivos', en: 'Objectives' },
  continue: { pt: 'Continuar', en: 'Continue' },
  views: { pt: 'Visualizações da rede', en: 'Network views' },
  calcPanel: { pt: 'Cálculo', en: 'Calculation' },
  checksPanel: { pt: 'Verificações', en: 'Checks' },
  sidePanel: { pt: 'Cálculo e verificações', en: 'Calculation and checks' },
  // Phone layout
  moreActions: { pt: 'Mais ações', en: 'More actions' },
  reverify: { pt: 'Recalcular', en: 'Recalculate' },
  sheetSection: { pt: 'Seção do painel', en: 'Panel section' },
  sheetExpand: { pt: 'Painel de cálculo: expandir', en: 'Calculation panel: expand' },
  sheetExpandFull: {
    pt: 'Painel de cálculo: expandir tudo',
    en: 'Calculation panel: expand fully',
  },
  sheetCollapse: { pt: 'Painel de cálculo: recolher', en: 'Calculation panel: collapse' },
  sheetClose: { pt: 'Recolher painel', en: 'Collapse panel' },
  issueCount: (count: number): LocalizedText => ({
    pt: count === 0 ? 'Sem pendências' : count === 1 ? '1 pendência' : `${count} pendências`,
    en: count === 0 ? 'No issues' : count === 1 ? '1 issue' : `${count} issues`,
  }),
  passedNotice: { pt: 'Etapa aprovada', en: 'Stage passed' },
  loading3d: { pt: 'Carregando a visualização 3D…', en: 'Loading the 3D view…' },
} as const;

export const formulaLabels: Record<HeadLossFormula, string> = {
  'hazen-williams': 'Hazen-Williams',
  'darcy-weisbach': 'Darcy-Weisbach',
};

export type StageTab = 'network' | 'table' | 'profile' | 'hardyCross' | 'pump' | '3d';

export const tabLabels: Record<StageTab, LocalizedText> = {
  network: { pt: 'Rede', en: 'Network' },
  table: { pt: 'Tabela', en: 'Table' },
  profile: { pt: 'Perfil', en: 'Profile' },
  hardyCross: { pt: 'Hardy Cross', en: 'Hardy Cross' },
  pump: { pt: 'Bomba', en: 'Pump' },
  '3d': { pt: '3D', en: '3D' },
};
