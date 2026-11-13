import {
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { IconChevronDown, IconChevronUp } from '../shell/icons';
import { releaseVelocity, SHEET_HALF, snapDetent, type Detent } from './sheetState';

interface BottomSheetProps {
  /**
   * `sheet`: slides up from the bottom bar between three detents. `side`: a panel that is
   * always open, for a phone held sideways.
   */
  mode: 'sheet' | 'side';
  detent: Detent;
  /** Height of the `half` detent as a fraction of the viewport height (see `SHEET_HALF`). */
  half?: number;
  /** Accessible name of the whole region. */
  label: string;
  /** Accessible name of the handle button; it says what the next press does. */
  handleLabel: string;
  collapseLabel: string;
  /** What the bar shows next to the handle: the selection or the state of the checks. */
  summary: ReactNode;
  /** The same in plain words; it is the accessible description of the handle. */
  summaryText: string;
  /** Controls at the top of the open panel (the section switch). */
  tools: ReactNode;
  /** The main action, always visible at the right of the bar. */
  action: ReactNode;
  /** Shown floating above the bar while the sheet is closed. */
  notice?: ReactNode;
  children: ReactNode;
  onCycle: () => void;
  onSnap: (detent: Detent) => void;
  onCollapse: () => void;
}

/** Finger travel (px) before a press on the handle becomes a drag instead of a tap. */
const DRAG_THRESHOLD = 6;

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  heights: Record<Detent, number>;
  samples: { time: number; y: number }[];
  moved: boolean;
}

/**
 * Bottom sheet of the phone layout. It is not a modal: there is no focus trap and what is
 * behind stays usable. The bar at the bottom never moves: it holds the handle (a button that
 * steps through the detents, and that can also be dragged) and the main action. The panel
 * grows above it and can be dragged by the grip strip at its top. Escape or the close button put it away.
 *
 * While a drag is on, the height is written straight to the element so it follows the finger
 * without rendering; on release the detent is reported with `onSnap` and CSS animates to it.
 */
export function BottomSheet({
  mode,
  detent,
  half = SHEET_HALF.phone,
  label,
  handleLabel,
  collapseLabel,
  summary,
  summaryText,
  tools,
  action,
  notice,
  children,
  onCycle,
  onSnap,
  onCollapse,
}: BottomSheetProps) {
  const panelId = useId();
  const summaryId = useId();
  const sheet = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  /** True right after a drag, so the click that follows the release does not cycle. */
  const dragged = useRef(false);

  const side = mode === 'side';
  const open = side || detent !== 'peek';

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const element = sheet.current;
    if (!element || side || drag.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const height = element.getBoundingClientRect().height;
    const panelHeight = panel.current?.getBoundingClientRect().height ?? 0;
    const container = element.offsetParent ?? element.parentElement;
    const full = container?.clientHeight || window.innerHeight;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      heights: {
        peek: height - panelHeight,
        half: Math.min(window.innerHeight * half, full),
        full,
      },
      samples: [{ time: event.timeStamp, y: event.clientY }],
      moved: false,
    };
    dragged.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    const element = sheet.current;
    if (!current || !element || event.pointerId !== current.pointerId) return;
    const travel = current.startY - event.clientY;
    if (!current.moved && Math.abs(travel) < DRAG_THRESHOLD) return;
    current.moved = true;
    current.samples.push({ time: event.timeStamp, y: event.clientY });
    if (current.samples.length > 8) current.samples.shift();
    const { peek, full } = current.heights;
    const height = Math.min(full, Math.max(peek, current.startHeight + travel));
    element.dataset.dragging = 'true';
    element.style.height = `${height}px`;
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const current = drag.current;
    const element = sheet.current;
    if (!current || !element || event.pointerId !== current.pointerId) return;
    drag.current = null;
    if (!current.moved) return;
    dragged.current = true;
    const height = element.getBoundingClientRect().height || current.startHeight;
    // The release is a sample too: a finger that stopped before lifting did not flick.
    current.samples.push({ time: event.timeStamp, y: event.clientY });
    const velocity = cancelled ? 0 : releaseVelocity(current.samples);
    // Back under CSS: the height animates from where the finger left it to the detent.
    delete element.dataset.dragging;
    element.style.height = '';
    onSnap(snapDetent(height, velocity, current.heights));
  };

  const dragHandlers = side
    ? {}
    : {
        onPointerDown,
        onPointerMove,
        onPointerUp: (event: ReactPointerEvent<HTMLElement>) => endDrag(event, false),
        onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => endDrag(event, true),
      };

  const collapse = () => {
    onCollapse();
    handle.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || side || detent === 'peek' || event.defaultPrevented) return;
    // Escape inside a dialog opened from the panel (a help text) closes that dialog only.
    if (event.target instanceof Element && event.target.closest('dialog')) return;
    event.preventDefault();
    collapse();
  };

  return (
    <section
      ref={sheet}
      className={side ? 'sheet sheet--side' : 'sheet'}
      data-detent={side ? undefined : detent}
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {!side && !open && notice && <div className="sheet__notice">{notice}</div>}

      {!side && (
        <div className="sheet__grip" aria-hidden="true" {...dragHandlers}>
          <span className="sheet__pill" />
        </div>
      )}

      <div
        ref={panel}
        id={panelId}
        className="sheet__panel"
        inert={!open}
        aria-hidden={open ? undefined : true}
      >
        <div className="sheet__tools">
          {tools}
          {!side && (
            <button
              type="button"
              className="btn btn--ghost btn--icon sheet__close"
              aria-label={collapseLabel}
              onClick={collapse}
            >
              <IconChevronDown />
            </button>
          )}
        </div>
        <div className="sheet__content">{children}</div>
      </div>

      <div className="sheet__bar">
        {!side && (
          <button
            ref={handle}
            type="button"
            className="sheet__handle"
            aria-label={handleLabel}
            aria-describedby={summaryId}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={(event) => {
              // A click from the keyboard (detail 0) is never the tail of a drag.
              const afterDrag = dragged.current && event.detail !== 0;
              dragged.current = false;
              if (!afterDrag) onCycle();
            }}
            {...dragHandlers}
          >
            <span className="sheet__handle-icon">
              {detent === 'full' ? <IconChevronDown /> : <IconChevronUp />}
            </span>
            <span className="sheet__summary" aria-hidden="true">
              {summary}
            </span>
            <span id={summaryId} className="visually-hidden">
              {summaryText}
            </span>
          </button>
        )}
        {action}
      </div>
    </section>
  );
}
