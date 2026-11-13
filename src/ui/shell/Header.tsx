import { useState } from 'react';
import type { HeadLossFormula } from '../../engine/types';
import { useTr } from '../../i18n';
import type { Lang, ThemeSetting } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { GlossaryDialog } from '../glossary/GlossaryDialog';
import { AboutDialog } from '../home/AboutDialog';
import { HowToPlayDialog } from '../home/HowToPlayDialog';
import { FORMULAS, formulaLabels, stageStrings } from '../stage/strings';
import { useDevice } from './breakpoints';
import { setHeaderSlot } from './headerSlot';
import { IconBack, IconBook, IconHelp, IconInfo, IconMenu, IconReset } from './icons';
import { Logo } from './Logo';
import { Menu, type MenuEntry } from './Menu';
import { shellStrings, themeLabels } from './strings';

const LANGS: { id: Lang; name: string; htmlLang: string }[] = [
  { id: 'pt', name: 'Português', htmlLang: 'pt-BR' },
  { id: 'en', name: 'English', htmlLang: 'en' },
];

const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

type HeaderDialog = 'howToPlay' | 'glossary' | 'about';

interface HeaderProps {
  /** Menu entries placed between the theme group and "Sobre" (for example "Instalar app"). */
  extraItems?: readonly MenuEntry[];
}

/**
 * The top bar of every screen: the logo (a link to the title screen) and one menu button with
 * how to play, the glossary, language, theme and about. With a stage open it also has the back
 * button and a slot the stage screen fills with its name and the briefing button (see
 * headerSlot.ts); on phones and tablets the stage actions (formula, reset) are in the menu.
 */
export function Header({ extraItems = [] }: HeaderProps) {
  const tr = useTr();
  const device = useDevice();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const setLang = useAppStore((s) => s.setLang);
  const setTheme = useAppStore((s) => s.setTheme);
  const scenario = useAppStore((s) => s.scenario);
  const formula = useAppStore((s) => s.formula);
  const setFormula = useAppStore((s) => s.setFormula);
  const resetDiameters = useAppStore((s) => s.resetDiameters);
  const closeStage = useAppStore((s) => s.closeStage);
  const goHome = useAppStore((s) => s.goHome);
  const [dialog, setDialog] = useState<HeaderDialog | null>(null);

  const phone = device === 'phone';
  const stageOpen = scenario !== null;

  const goToTitle = () => {
    if (stageOpen) closeStage();
    goHome();
  };

  // Desktop shows the stage actions in the bar of the stage screen instead.
  const stageEntries: MenuEntry[] =
    stageOpen && device !== 'desktop'
      ? [
          {
            kind: 'radio',
            id: 'formula',
            label: tr(stageStrings.formula),
            value: formula,
            options: FORMULAS.map((option) => ({ value: option, label: formulaLabels[option] })),
            onChange: (value) => setFormula(value as HeadLossFormula),
          },
          {
            kind: 'action',
            id: 'reset',
            label: tr(stageStrings.reset),
            icon: <IconReset />,
            onSelect: resetDiameters,
          },
        ]
      : [];

  const entries: MenuEntry[] = [
    ...stageEntries,
    {
      kind: 'action',
      id: 'howToPlay',
      label: tr(shellStrings.howToPlay),
      icon: <IconHelp />,
      onSelect: () => setDialog('howToPlay'),
    },
    {
      kind: 'action',
      id: 'glossary',
      label: tr(shellStrings.glossary),
      icon: <IconBook />,
      onSelect: () => setDialog('glossary'),
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
    // The install item goes here: pass it in `extraItems`.
    ...extraItems,
    {
      kind: 'action',
      id: 'about',
      label: tr(shellStrings.about),
      icon: <IconInfo />,
      onSelect: () => setDialog('about'),
    },
  ];

  const close = () => setDialog(null);

  return (
    <header
      className={phone ? 'header header--compact' : 'header'}
      data-stage={stageOpen ? 'true' : undefined}
    >
      {/* On a phone with a stage open the row has no room for the logo: back leads out. */}
      {!(phone && stageOpen) && (
        <button
          type="button"
          className="header__brand"
          aria-label={tr(shellStrings.homeLabel)}
          onClick={goToTitle}
        >
          <Logo />
          <span className="header__name">{tr(shellStrings.appName)}</span>
        </button>
      )}

      {stageOpen && (
        <>
          <button
            type="button"
            className={phone ? 'btn btn--ghost btn--icon header__back' : 'btn btn--sm header__back'}
            aria-label={tr(shellStrings.backToStagesLabel)}
            title={tr(shellStrings.backToStagesLabel)}
            onClick={closeStage}
          >
            <IconBack />
            {!phone && tr(shellStrings.backToStages)}
          </button>
          <div className="header__stage" ref={setHeaderSlot} />
        </>
      )}

      <Menu
        className="header__menu"
        label={tr(shellStrings.menu)}
        icon={<IconMenu />}
        entries={entries}
      />

      <HowToPlayDialog open={dialog === 'howToPlay'} onClose={close} />
      <GlossaryDialog open={dialog === 'glossary'} onClose={close} />
      <AboutDialog open={dialog === 'about'} onClose={close} />
    </header>
  );
}
