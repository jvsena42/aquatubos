import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTr } from '../../i18n';
import { GLOSSARY, type TermId } from './glossary';
import './glossary.css';

interface TermProps {
  id: TermId;
  /** Text shown in place. Defaults to the name of the term. */
  children?: ReactNode;
}

const MARGIN = 8;
const MAX_WIDTH = 320;

/**
 * Technical term with its definition in a tooltip. The tooltip opens on hover, focus and
 * tap, stays open while the pointer is over it and closes with Escape.
 * Do not place it inside a <button> or a link.
 */
export function Term({ id, children }: TermProps) {
  const tr = useTr();
  const entry = GLOSSARY[id];
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(MAX_WIDTH, window.innerWidth - 2 * MARGIN);
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
      const below = rect.bottom + 4;
      // Opens above the term when there is little room below it.
      setPosition(
        window.innerHeight - below < 160 && rect.top > 160
          ? { left, width, bottom: window.innerHeight - rect.top + 4 }
          : { left, width, top: below },
      );
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  // The tooltip is fixed to the viewport, so it closes when the page scrolls under it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  return (
    <span className="term" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={triggerRef}
        type="button"
        className="term__trigger"
        aria-describedby={tooltipId}
        onFocus={show}
        onBlur={hide}
        onClick={show}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            hide();
          }
        }}
      >
        {children ?? tr(entry.term)}
      </button>
      <span id={tooltipId} role="tooltip" className="term__tooltip" style={position} hidden={!open}>
        <strong className="term__name">{tr(entry.term)}</strong>
        {tr(entry.definition)}
      </span>
    </span>
  );
}
