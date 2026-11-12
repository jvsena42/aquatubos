import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { useTr } from '../../i18n';
import { IconClose } from './icons';
import { shellStrings } from './strings';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons shown at the bottom. */
  footer?: ReactNode;
}

/** Modal dialog on the native <dialog>: focus trap, Escape and focus return come with it. */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const tr = useTr();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  // A click on the backdrop lands on the <dialog> element itself.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={onBackdropClick}
    >
      {open && (
        <div className="dialog__inner">
          <header className="dialog__header">
            <h2 id={titleId}>{title}</h2>
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm"
              aria-label={tr(shellStrings.close)}
              onClick={onClose}
            >
              <IconClose />
            </button>
          </header>
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
