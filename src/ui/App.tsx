import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/global.css';
import './shell/shell.css';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useTr } from '../i18n';
import { useAppStore } from '../state/store';
import { useDevice, useDeviceAttributes } from './shell/breakpoints';
import { Header } from './shell/Header';
import { IconInstall, InstallHint, useInstallAction } from './shell/InstallApp';
import type { MenuEntry } from './shell/Menu';
import { PwaNotice } from './shell/PwaNotice';
import { shellStrings } from './shell/strings';
import { HomeScreen } from './home/HomeScreen';
import { StageSelect } from './stages/StageSelect';

// The stage screen (network view, panels, charts) is loaded when the first stage opens.
const StageScreen = lazy(() =>
  import('./stage/StageScreen').then((module) => ({ default: module.StageScreen })),
);

const HTML_LANG = { pt: 'pt-BR', en: 'en' } as const;

/**
 * Moves focus to the main heading of the screen that was just shown, so keyboard and screen
 * reader users land on it. While the screen is still loading, focus waits on <main> and moves to
 * the heading when it appears. The heading of a stage is in the app header (see headerSlot.ts),
 * so the search covers the whole app. Returns a cleanup function.
 */
function focusScreenHeading(main: HTMLElement): () => void {
  const app = main.parentElement ?? main;
  const focusHeading = (): boolean => {
    const heading = app.querySelector('h1');
    if (!heading) return false;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    // A modal dialog that is already open (the stage briefing) keeps the focus.
    if (!document.querySelector('dialog[open]')) heading.focus();
    return true;
  };
  if (focusHeading()) return () => undefined;
  main.focus();
  const observer = new MutationObserver(() => {
    if (focusHeading()) observer.disconnect();
  });
  observer.observe(app, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function App() {
  useDeviceAttributes();
  const install = useInstallAction();
  const tr = useTr();
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const scenarioId = useAppStore((s) => s.scenario?.id ?? null);
  const screen = useAppStore((s) => s.screen);

  const hydrateStarted = useRef(false);
  useEffect(() => {
    if (hydrateStarted.current) return;
    hydrateStarted.current = true;
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);

  // One key per screen: it restarts the enter animation and tells when to move the focus.
  const screenKey = !hydrated ? 'loading' : scenarioId ? `stage:${scenarioId}` : screen;
  const mainRef = useRef<HTMLElement>(null);
  const shownKey = useRef<string | null>(null);
  // A layout effect, so the heading has focus before a dialog of the new screen opens and the
  // dialog gives the focus back to the heading when it closes.
  useLayoutEffect(() => {
    const previous = shownKey.current;
    shownKey.current = screenKey;
    // The first screen after loading keeps the browser's initial focus.
    if (previous === null || previous === 'loading' || !mainRef.current) return;
    return focusScreenHeading(mainRef.current);
  }, [screenKey]);

  const bleed = hydrated && !scenarioId && screen === 'home';
  // On phones and tablets an open stage is a fixed frame the size of the viewport (shell.css).
  const device = useDevice();
  const shell = device !== 'desktop' && hydrated && scenarioId !== null;
  const mainClass = shell
    ? 'app__main app__main--shell'
    : bleed
      ? 'app__main app__main--bleed'
      : 'app__main';

  // "Instalar app" appears in the menu only where installing is possible and not done yet.
  const installItems: MenuEntry[] = install.available
    ? [
        {
          kind: 'action',
          id: 'install',
          label: install.label,
          icon: <IconInstall />,
          onSelect: install.start,
        },
      ]
    : [];

  return (
    <div className={shell ? 'app app--shell' : 'app'}>
      <a className="skip-link" href="#main">
        {tr(shellStrings.skipToContent)}
      </a>
      <Header extraItems={installItems} />
      <main id="main" ref={mainRef} className={mainClass} tabIndex={-1}>
        <div key={screenKey} className="screen">
          {!hydrated ? (
            <p className="app__loading" role="status">
              {tr(shellStrings.loading)}
            </p>
          ) : scenarioId ? (
            <Suspense
              fallback={
                <p className="app__loading" role="status">
                  {tr(shellStrings.loading)}
                </p>
              }
            >
              <StageScreen key={scenarioId} />
            </Suspense>
          ) : screen === 'map' ? (
            <StageSelect />
          ) : (
            <HomeScreen />
          )}
        </div>
      </main>
      <PwaNotice />
      <InstallHint />
      {install.dialog}
    </div>
  );
}
