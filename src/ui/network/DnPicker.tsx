import { COMMERCIAL_DNS, catalogEntry } from '../../engine/cost';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { money } from '../shell/strings';
import { networkStrings } from './strings';
import './dnPicker.css';

interface DnPickerProps {
  pipeId: string;
  /** Only the DN numbers; the price stays in the accessible name and in the tooltip. */
  compact?: boolean;
  /**
   * With `compact`: also the price per metre as a bare number under each DN (phones, where
   * there is no tooltip). The unit is written once next to the picker.
   */
  prices?: boolean;
}

/** Commercial diameters of one pipe as a segmented control. Writes to the store. */
export function DnPicker({ pipeId, compact = false, prices = false }: DnPickerProps) {
  const tr = useTr();
  const fmt = useFormat();
  const pipe = useAppStore((s) => s.scenario?.pipes.find((p) => p.id === pipeId));
  const current = useAppStore((s) => s.diameters[pipeId]);
  const setDiameter = useAppStore((s) => s.setDiameter);

  if (!pipe) return null;
  const fixed = pipe.fixed === true;
  const selected = current ?? pipe.initialDN;

  return (
    <div
      className={[
        'dn-picker',
        compact && 'dn-picker--compact',
        compact && prices && 'dn-picker--prices',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="segmented dn-picker__options"
        role="group"
        aria-label={tr(networkStrings.dnGroup(pipeId))}
      >
        {COMMERCIAL_DNS.map((dn) => {
          const price = money(fmt(catalogEntry(dn).pricePerMeter, 2));
          const label = tr(networkStrings.dnOption(dn, price));
          return (
            <button
              key={dn}
              type="button"
              aria-pressed={dn === selected}
              aria-label={label}
              title={label}
              disabled={fixed}
              onClick={() => setDiameter(pipeId, dn)}
            >
              <span className="num dn-picker__dn">{dn}</span>
              {!compact && (
                <span className="dn-picker__price">
                  {money(fmt(catalogEntry(dn).pricePerMeter, 0))}
                  {tr(networkStrings.perMetre)}
                </span>
              )}
              {compact && prices && (
                <span className="num dn-picker__price" aria-hidden="true">
                  {fmt(catalogEntry(dn).pricePerMeter, 0)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {fixed && <p className="dn-picker__fixed muted">{tr(networkStrings.fixedPipe)}</p>}
    </div>
  );
}
