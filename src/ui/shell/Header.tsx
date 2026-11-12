import { useState } from 'react';
import { useTr } from '../../i18n';
import type { Lang, ThemeSetting } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { GlossaryDialog } from '../glossary/GlossaryDialog';
import { IconBack, IconBook } from './icons';
import { Logo } from './Logo';
import { shellStrings, themeLabels } from './strings';

const LANGS: { id: Lang; short: string; name: string; htmlLang: string }[] = [
  { id: 'pt', short: 'PT', name: 'Português', htmlLang: 'pt-BR' },
  { id: 'en', short: 'EN', name: 'English', htmlLang: 'en' },
];

const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

export function Header() {
  const tr = useTr();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const setLang = useAppStore((s) => s.setLang);
  const setTheme = useAppStore((s) => s.setTheme);
  const stageOpen = useAppStore((s) => s.scenario !== null);
  const closeStage = useAppStore((s) => s.closeStage);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  return (
    <header className="header">
      <div className="header__brand">
        <Logo />
        <span className="header__name">{tr(shellStrings.appName)}</span>
      </div>

      {stageOpen && (
        <button
          type="button"
          className="btn btn--sm"
          aria-label={tr(shellStrings.backToStagesLabel)}
          onClick={closeStage}
        >
          <IconBack />
          {tr(shellStrings.backToStages)}
        </button>
      )}

      <div className="header__tools">
        <button type="button" className="btn btn--sm" onClick={() => setGlossaryOpen(true)}>
          <IconBook />
          <span className="header__tool-label">{tr(shellStrings.glossary)}</span>
        </button>

        <div className="segmented" role="group" aria-label={tr(shellStrings.language)}>
          {LANGS.map((option) => (
            <button
              key={option.id}
              type="button"
              lang={option.htmlLang}
              aria-label={option.name}
              aria-pressed={lang === option.id}
              onClick={() => setLang(option.id)}
            >
              {option.short}
            </button>
          ))}
        </div>

        <div className="segmented" role="group" aria-label={tr(shellStrings.theme)}>
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
            >
              {tr(themeLabels[option])}
            </button>
          ))}
        </div>
      </div>

      <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </header>
  );
}
