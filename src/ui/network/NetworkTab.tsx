import { useTr } from '../../i18n';
import type { NetworkViewMode } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { TownView } from '../town/TownView';
import { NetworkView } from './NetworkView';
import './networkTab.css';

const MODES: { id: NetworkViewMode; label: { pt: string; en: string } }[] = [
  { id: 'town', label: { pt: 'Cidade', en: 'Town' } },
  { id: 'schematic', label: { pt: 'Esquema', en: 'Schematic' } },
];

const GROUP_LABEL = { pt: 'Modo de visualização da rede', en: 'Network view mode' };

/**
 * Body of the network tab: the illustrated town (default) or the engineering schematic. Both
 * draw the same scenario and share the selection in the store; the choice is a saved preference.
 */
export function NetworkTab() {
  const tr = useTr();
  const mode = useAppStore((s) => s.networkView);
  const setMode = useAppStore((s) => s.setNetworkView);

  return (
    <div className="network-tab">
      <div className="segmented network-tab__toggle" role="group" aria-label={tr(GROUP_LABEL)}>
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
          >
            {tr(option.label)}
          </button>
        ))}
      </div>
      {mode === 'town' ? <TownView /> : <NetworkView />}
    </div>
  );
}
