import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  /** Prefix of the tab and panel element ids; see `tabId` and `tabPanelId`. */
  idBase: string;
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function tabId(idBase: string, id: string): string {
  return `${idBase}-tab-${id}`;
}

export function tabPanelId(idBase: string, id: string): string {
  return `${idBase}-panel-${id}`;
}

/** Space (px) kept between the active tab and the edge of a scrolled list: the fade width. */
const EDGE = 32;

/**
 * Tab list following the WAI-ARIA tabs pattern with automatic activation: arrow keys, Home
 * and End move focus and select the tab. The caller renders the panel with role="tabpanel",
 * `id={tabPanelId(...)}` and `aria-labelledby={tabId(...)}`.
 *
 * The list is one row that scrolls sideways when it does not fit: the active tab is kept in
 * view and `data-more-start` / `data-more-end` mark the edges with more tabs (faded in CSS).
 */
export function Tabs<T extends string>({ idBase, label, tabs, active, onChange }: TabsProps<T>) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const mark = () => {
      const hidden = element.scrollWidth - element.clientWidth;
      element.toggleAttribute('data-more-start', element.scrollLeft > 1);
      element.toggleAttribute('data-more-end', hidden - element.scrollLeft > 1);
    };
    mark();
    element.addEventListener('scroll', mark, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(mark) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', mark);
      observer?.disconnect();
    };
  }, [tabs.length]);

  // Only the list scrolls: scrollIntoView could also move the page.
  useEffect(() => {
    const element = list.current;
    const tab = document.getElementById(tabId(idBase, active));
    if (!element || !tab) return;
    const outer = element.getBoundingClientRect();
    const inner = tab.getBoundingClientRect();
    if (inner.left < outer.left + EDGE) element.scrollLeft -= outer.left + EDGE - inner.left;
    else if (inner.right > outer.right - EDGE) {
      element.scrollLeft += inner.right - (outer.right - EDGE);
    }
  }, [idBase, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onChange(target.id);
    document.getElementById(tabId(idBase, target.id))?.focus();
  };

  return (
    <div ref={list} className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idBase, tab.id)}
            className="tabs__tab"
            aria-selected={selected}
            aria-controls={tabPanelId(idBase, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
