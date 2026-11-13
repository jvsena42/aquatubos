import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTr } from '../../i18n';
import { usePhone } from './breakpoints';
import { Dialog } from './Dialog';
import './help.css';

const HELP_PREFIX = { pt: 'Ajuda', en: 'Help' };

interface HelpButtonProps {
  /** What the help is about, 1–4 words. Used in the accessible name ("Ajuda: Pressão mínima")
   * and as the title of the help. */
  topic: string;
  /** The explanation. Keep the text in the strings files; pass it already translated. */
  children: ReactNode;
  /** Extra class on the wrapper, for placement by the parent. */
  className?: string;
}

/**
 * A small "?" button that shows an explanation: a popover next to the button on tablets and
 * desktops, a dialog on phones. The default UI stays short and everything that explains goes
 * behind one of these. Nothing needed to complete a stage may live only inside help.
 *
 * Keyboard: Enter/Space toggles, Escape closes and returns focus to the button. A press outside
 * closes the popover. The button has a 44 px hit area on touch screens (see help.css).
 */
export function HelpButton({ topic, children, className }: HelpButtonProps) {
  const tr = useTr();
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'start' | 'end'>('start');
  const wrapper = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const label = `${tr(HELP_PREFIX)}: ${topic}`;

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  // Open towards the side with more room so the popover stays inside the viewport.
  useLayoutEffect(() => {
    if (!open || phone || !button.current) return;
    const box = button.current.getBoundingClientRect();
    const width = document.documentElement.clientWidth || window.innerWidth;
    setAlign(box.left + box.width / 2 > width / 2 ? 'end' : 'start');
  }, [open, phone]);

  useEffect(() => {
    if (!open || phone) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, phone]);

  return (
    <span ref={wrapper} className={className ? `help ${className}` : 'help'}>
      <button
        ref={button}
        type="button"
        className="help__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={!phone && open ? popoverId : undefined}
        aria-haspopup={phone ? 'dialog' : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {phone ? (
        <Dialog open={open} onClose={() => close(true)} title={topic}>
          <div className="help__content">{children}</div>
        </Dialog>
      ) : (
        open && (
          <span
            id={popoverId}
            role="note"
            aria-label={label}
            className={`help__popover help__popover--${align}`}
          >
            <strong className="help__title">{topic}</strong>
            <span className="help__content">{children}</span>
          </span>
        )
      )}
    </span>
  );
}
