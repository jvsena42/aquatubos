import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/global.css';
import './shell/shell.css';
import { useEffect, useRef } from 'react';
import { useTr } from '../i18n';
import { useAppStore } from '../state/store';
import { Header } from './shell/Header';
import { PwaNotice } from './shell/PwaNotice';
import { shellStrings } from './shell/strings';
import { StageScreen } from './stage/StageScreen';
import { StageSelect } from './stages/StageSelect';

const HTML_LANG = { pt: 'pt-BR', en: 'en' } as const;

export function App() {
  const tr = useTr();
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const scenarioId = useAppStore((s) => s.scenario?.id ?? null);

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

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {tr(shellStrings.skipToContent)}
      </a>
      <Header />
      <main id="main" className="app__main" tabIndex={-1}>
        {!hydrated ? (
          <p className="app__loading" role="status">
            {tr(shellStrings.loading)}
          </p>
        ) : scenarioId ? (
          <StageScreen key={scenarioId} />
        ) : (
          <StageSelect />
        )}
      </main>
      <PwaNotice />
    </div>
  );
}
