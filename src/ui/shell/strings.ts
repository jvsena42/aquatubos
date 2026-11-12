import type { LocalizedText } from '../../engine/types';
import type { ThemeSetting } from '../../persistence/db';

export const shellStrings = {
  appName: { pt: 'Aquatubos', en: 'Aquatubos' },
  loading: { pt: 'Carregando…', en: 'Loading…' },
  skipToContent: { pt: 'Ir para o conteúdo', en: 'Skip to content' },
  backToStages: { pt: 'Etapas', en: 'Stages' },
  backToStagesLabel: { pt: 'Voltar para a lista de etapas', en: 'Back to the stage list' },
  glossary: { pt: 'Glossário', en: 'Glossary' },
  language: { pt: 'Idioma', en: 'Language' },
  theme: { pt: 'Tema', en: 'Theme' },
  close: { pt: 'Fechar', en: 'Close' },
  stars: (value: number): LocalizedText => ({
    pt: `${value} de 3 estrelas`,
    en: `${value} of 3 stars`,
  }),
  offlineReady: {
    pt: 'Pronto para uso sem internet.',
    en: 'Ready to work offline.',
  },
  updateAvailable: {
    pt: 'Há uma nova versão disponível.',
    en: 'A new version is available.',
  },
  reload: { pt: 'Atualizar', en: 'Update' },
  dismiss: { pt: 'Dispensar', en: 'Dismiss' },
} satisfies Record<string, LocalizedText | ((value: number) => LocalizedText)>;

export const themeLabels: Record<ThemeSetting, LocalizedText> = {
  system: { pt: 'Sistema', en: 'System' },
  light: { pt: 'Claro', en: 'Light' },
  dark: { pt: 'Escuro', en: 'Dark' },
};

const NBSP = String.fromCharCode(0xa0);

/** Formats a value in reais using an already localized number. */
export function money(formatted: string): string {
  return 'R$' + NBSP + formatted;
}
