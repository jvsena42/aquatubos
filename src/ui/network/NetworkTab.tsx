import type { ReactNode } from 'react';
import { useTr } from '../../i18n';
import type { NetworkViewMode } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { IconSchematic, IconTown } from '../shell/icons';
import { TownView } from '../town/TownView';
import { NetworkView } from './NetworkView';
import './networkTab.css';

const MODES: { id: NetworkViewMode; label: { pt: string; en: string }; icon: ReactNode }[] = [
  { id: 'town', label: { pt: 'Cidade', en: 'Town' }, icon: <IconTown /> },
  { id: 'schematic', label: { pt: 'Esquema', en: 'Schematic' }, icon: <IconSchematic /> },
];

const GROUP_LABEL = { pt: 'Modo de visualização da rede', en: 'Network view mode' };

interface NetworkModeToggleProps {
  /** Icons instead of words, for the tab row of the phone layout. The names stay the same. */
  compact?: boolean;
}

/** Switch between the illustrated town and the schematic; the choice is a saved preference. */
export function NetworkModeToggle({ compact = false }: NetworkModeToggleProps) {
  const tr = useTr();
  const mode = useAppStore((s) => s.networkView);
  const setMode = useAppStore((s) => s.setNetworkView);

  return (
    <div
      className={
        compact
          ? 'segmented network-tab__toggle network-tab__toggle--compact'
          : 'segmented network-tab__toggle'
      }
      role="group"
      aria-label={tr(GROUP_LABEL)}
    >
      {MODES.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={mode === option.id}
          aria-label={compact ? tr(option.label) : undefined}
          title={compact ? tr(option.label) : undefined}
          onClick={() => setMode(option.id)}
        >
          {compact ? option.icon : tr(option.label)}
        </button>
      ))}
    </div>
  );
}

interface NetworkTabProps {
  /** False when the caller shows `NetworkModeToggle` somewhere else (phone tab row). */
  toggle?: boolean;
}

/**
 * Body of the network tab: the illustrated town (default) or the engineering schematic. Both
 * draw the same scenario and share the selection in the store.
 */
export function NetworkTab({ toggle = true }: NetworkTabProps) {
  const mode = useAppStore((s) => s.networkView);

  return (
    <div className="network-tab">
      {toggle && <NetworkModeToggle />}
      {mode === 'town' ? <TownView /> : <NetworkView />}
    </div>
  );
}
