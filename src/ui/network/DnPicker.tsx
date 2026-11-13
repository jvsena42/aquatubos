import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COMMERCIAL_DNS, catalogEntry } from '../../engine/cost';
import { useFormat, useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { scrollEdges, type ScrollEdges } from '../charts/scrollEdges';
import { money } from '../shell/strings';
import { networkStrings } from './strings';
import './dnPicker.css';

interface DnPickerProps {
  pipeId: string;
  /**
   * `grid` (default): keys with the DN and the price per metre, wrapping; for a panel.
   * `bar`: one row of 44 px keys that scrolls sideways, DN over price; for the phone map.
   */
  variant?: 'grid' | 'bar';
  /** Id of the group of keys, so other parts of the screen can move the focus to it. */
  id?: string;
}

const NO_EDGES: ScrollEdges = { start: false, end: false };

/** Commercial diameters of one pipe as a segmented control. Writes to the store. */
export function DnPicker({ pipeId, variant = 'grid', id }: DnPickerProps) {
  const tr = useTr();
  const fmt = useFormat();
  const pipe = useAppStore((s) => s.scenario?.pipes.find((p) => p.id === pipeId));
  const current = useAppStore((s) => s.diameters[pipeId]);
  const setDiameter = useAppStore((s) => s.setDiameter);
  const group = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES);
  const bar = variant === 'bar';
  const selected = current ?? pipe?.initialDN;

  const updateEdges = useCallback(() => {
    const element = group.current;
    if (!element || !bar) return;
    const next = scrollEdges(element.scrollLeft, element.clientWidth, element.scrollWidth);
    setEdges((now) => (now.start === next.start && now.end === next.end ? now : next));
  }, [bar]);

  // The row scrolls sideways: the pressed key is brought to the middle when the pipe or its
  // diameter changes, so the current choice is never off screen.
  useLayoutEffect(() => {
    const element = group.current;
    if (!bar || !element) return;
    const key = element.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (key) {
      element.scrollLeft = key.offsetLeft - (element.clientWidth - key.offsetWidth) / 2;
    }
    updateEdges();
  }, [bar, pipeId, selected, updateEdges]);

  useEffect(() => {
    const element = group.current;
    if (!bar || !element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bar, updateEdges]);

  if (!pipe) return null;
  const fixed = pipe.fixed === true;

  return (
    <div
      className={bar ? 'dn-picker dn-picker--bar' : 'dn-picker'}
      data-fade-start={edges.start}
      data-fade-end={edges.end}
    >
      <div
        ref={group}
        id={id}
        className="segmented dn-picker__options"
        role="group"
        aria-label={tr(networkStrings.dnGroup(pipeId))}
        onScroll={bar ? updateEdges : undefined}
      >
        {COMMERCIAL_DNS.map((dn) => {
          const price = catalogEntry(dn).pricePerMeter;
          const label = tr(networkStrings.dnOption(dn, money(fmt(price, 2))));
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
              <span className="num dn-picker__price" aria-hidden="true">
                {money(fmt(price, 0))}
                {!bar && tr(networkStrings.perMetre)}
              </span>
            </button>
          );
        })}
      </div>
      {fixed && !bar && <p className="dn-picker__fixed muted">{tr(networkStrings.fixedPipe)}</p>}
    </div>
  );
}
