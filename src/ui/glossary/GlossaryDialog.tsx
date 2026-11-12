import { useMemo } from 'react';
import { useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { Dialog } from '../shell/Dialog';
import { GLOSSARY, TERM_IDS } from './glossary';
import { glossaryStrings } from './strings';
import './glossary.css';

/** Lists every glossary term in alphabetical order of the current language. */
export function GlossaryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTr();
  const lang = useAppStore((s) => s.lang);
  const ids = useMemo(
    () =>
      [...TERM_IDS].sort((a, b) =>
        GLOSSARY[a].term[lang].localeCompare(GLOSSARY[b].term[lang], lang),
      ),
    [lang],
  );

  return (
    <Dialog open={open} onClose={onClose} title={tr(glossaryStrings.title)}>
      <p className="glossary__intro">{tr(glossaryStrings.intro)}</p>
      <dl className="glossary__list">
        {ids.map((id) => (
          <div key={id}>
            <dt>{tr(GLOSSARY[id].term)}</dt>
            <dd>{tr(GLOSSARY[id].definition)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
