import { useState } from 'react';
import { useTr } from '../../i18n';
import type { Lang, ThemeSetting } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { GlossaryDialog } from '../glossary/GlossaryDialog';
import { stageStrings } from '../stage/strings';
import { IconBack, IconBook, IconSettings } from './icons';
import { Logo } from './Logo';
import { Menu, type MenuEntry } from './Menu';
import { shellStrings, themeLabels } from './strings';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';

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
  const scenario = useAppStore((s) => s.scenario);
  const stageOpen = scenario !== null;
  const closeStage = useAppStore((s) => s.closeStage);
  const goHome = useAppStore((s) => s.goHome);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const phone = useMediaQuery(PHONE_QUERY);

  const goToTitle = () => {
    if (stageOpen) closeStage();
    goHome();
  };

  // On phones the header is one row: logo, back, the stage name and a menu with the rest.
  if (phone) {
    const entries: MenuEntry[] = [
      {
        kind: 'action',
        id: 'glossary',
        label: tr(shellStrings.glossary),
        icon: <IconBook />,
        onSelect: () => setGlossaryOpen(true),
      },
      {
        kind: 'radio',
        id: 'language',
        label: tr(shellStrings.language),
        value: lang,
        options: LANGS.map((option) => ({
          value: option.id,
          label: option.name,
          lang: option.htmlLang,
        })),
        onChange: (value) => setLang(value as Lang),
      },
      {
        kind: 'radio',
        id: 'theme',
        label: tr(shellStrings.theme),
        value: theme,
        options: THEMES.map((option) => ({ value: option, label: tr(themeLabels[option]) })),
        onChange: (value) => setTheme(value as ThemeSetting),
      },
    ];
    return (
      <header className="header header--compact">
        <button
          type="button"
          className="header__brand"
          aria-label={tr(shellStrings.homeLabel)}
          onClick={goToTitle}
        >
          <Logo />
          {!scenario && <span className="header__name">{tr(shellStrings.appName)}</span>}
        </button>

        {scenario && (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--icon header__back"
              aria-label={tr(shellStrings.backToStagesLabel)}
              onClick={closeStage}
            >
              <IconBack />
            </button>
            {/* The stage screen has the real heading; this copy only shows it in the app bar. */}
            <p className="header__context" aria-hidden="true">
              <span className="header__context-kicker">
                {tr(stageStrings.stage(scenario.order))}
              </span>
              <span className="header__context-title">{tr(scenario.title)}</span>
            </p>
          </>
        )}

        <Menu
          className="header__menu"
          label={tr(shellStrings.settings)}
          icon={<IconSettings />}
          entries={entries}
        />

        <GlossaryDialog open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      </header>
    );
  }

  return (
    <header className="header">
      <button
        type="button"
        className="header__brand"
        aria-label={tr(shellStrings.homeLabel)}
        onClick={goToTitle}
      >
        <Logo />
        <span className="header__name">{tr(shellStrings.appName)}</span>
      </button>

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
