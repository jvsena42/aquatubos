import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { IconRadioOff, IconRadioOn } from './icons';

export interface MenuAction {
  kind: 'action';
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface MenuRadioGroup {
  kind: 'radio';
  id: string;
  /** Name of the group, shown as a small heading above its options. */
  label: string;
  value: string;
  options: readonly { value: string; label: string; lang?: string }[];
  onChange: (value: string) => void;
}

export type MenuEntry = MenuAction | MenuRadioGroup;

interface MenuProps {
  /** Accessible name of the button and of the menu. */
  label: string;
  icon: ReactNode;
  entries: readonly MenuEntry[];
  /** Extra class of the wrapper. */
  className?: string;
}

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

/**
 * Icon button that opens a menu (WAI-ARIA menu button pattern): Enter, Space or the arrow keys
 * open it, the arrow keys, Home and End move between the items, Escape or a tap outside closes
 * it. Choosing an item runs it, closes the menu and gives the focus back to the button.
 */
export function Menu({ label, icon, entries, className }: MenuProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /** Item that takes the focus when the menu opens. */
  const enterAt = useRef<'first' | 'last'>('first');

  const items = (): HTMLElement[] =>
    Array.from(list.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);

  useEffect(() => {
    if (!open) return;
    const all = Array.from(list.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    (enterAt.current === 'last' ? all[all.length - 1] : all[0])?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openAt = (where: 'first' | 'last') => {
    enterAt.current = where;
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(event.key === 'ArrowUp' ? 'last' : 'first');
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const all = items();
    const index = all.findIndex((item) => item === document.activeElement);
    const moves: Record<string, number> = {
      ArrowDown: (index + 1) % all.length,
      ArrowUp: (index - 1 + all.length) % all.length,
      Home: 0,
      End: all.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    all[next]?.focus();
  };

  const run = (action: () => void) => {
    action();
    close(true);
  };

  return (
    <div className={className ? `menu ${className}` : 'menu'} ref={root}>
      <button
        ref={button}
        type="button"
        className="btn btn--ghost btn--icon menu__button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : openAt('first'))}
        onKeyDown={onButtonKeyDown}
      >
        {icon}
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          className="menu__list"
          role="menu"
          aria-label={label}
          onKeyDown={onListKeyDown}
        >
          {entries.map((entry) =>
            entry.kind === 'action' ? (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="menu__item"
                onClick={() => run(entry.onSelect)}
              >
                <span className="menu__icon">{entry.icon}</span>
                {entry.label}
              </button>
            ) : (
              <div
                key={entry.id}
                className="menu__group"
                role="group"
                aria-labelledby={`${id}-${entry.id}`}
              >
                <span id={`${id}-${entry.id}`} className="menu__heading">
                  {entry.label}
                </span>
                {entry.options.map((option) => {
                  const checked = option.value === entry.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      tabIndex={-1}
                      lang={option.lang}
                      className="menu__item"
                      onClick={() => run(() => entry.onChange(option.value))}
                    >
                      <span className="menu__icon">
                        {checked ? <IconRadioOn /> : <IconRadioOff />}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
