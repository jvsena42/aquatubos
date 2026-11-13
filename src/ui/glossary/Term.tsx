import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTr } from '../../i18n';
import { GLOSSARY, type TermId } from './glossary';
import { useTermRepeat } from './TermScope';
import { placeTooltip, tooltipWidth } from './tooltipPosition';
import './glossary.css';

interface TermProps {
  id: TermId;
  /** Text shown in place. Defaults to the name of the term. */
  children?: ReactNode;
}

const UNPLACED: CSSProperties = {};

/**
 * Whether a pointer entering the term is a hover. Only a mouse on a device that can hover: on a
 * phone the browser keeps an emulated mouse where the last tap was, and content scrolling under
 * that point must not open tooltips.
 */
function hovers(pointerType: string): boolean {
  if (pointerType !== 'mouse') return false;
  return typeof window.matchMedia !== 'function' || window.matchMedia('(hover: hover)').matches;
}

function viewportSize() {
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Technical term with its definition in a tooltip.
 *
 * With a mouse the tooltip opens on hover and stays open while the pointer is over it. With the
 * keyboard it opens on focus, and Enter or Space toggles it. On a touch screen a tap opens it
 * and a second tap closes it. A press anywhere else, Escape, scrolling and leaving the term
 * close it.
 *
 * The tooltip is rendered in a portal at the end of the document (or of the open dialog the
 * term is in) with fixed coordinates, so no scrolling or clipping container cuts it, and it is
 * placed inside the viewport by `placeTooltip`.
 *
 * Do not place it inside a <button> or a link.
 */
export function Term({ id, children }: TermProps) {
  const tr = useTr();
  const anchor = useRef<HTMLSpanElement>(null);
  const repeat = useTermRepeat(id, anchor);
  // A repeat inside a TermScope reads as plain text: the first occurrence carries the tooltip.
  if (repeat) {
    return (
      <span ref={anchor} className="term term--repeat">
        {children ?? tr(GLOSSARY[id].term)}
      </span>
    );
  }
  return (
    <InteractiveTerm id={id} anchor={anchor}>
      {children}
    </InteractiveTerm>
  );
}

function InteractiveTerm({
  id,
  children,
  anchor,
}: TermProps & { anchor: RefObject<HTMLSpanElement | null> }) {
  const tr = useTr();
  const entry = GLOSSARY[id];
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>(UNPLACED);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  // What the press that leads to the next click found: the pointer and whether it was open.
  const press = useRef<{ type: string; wasOpen: boolean } | null>(null);
  // A press on the tooltip takes the focus from the term, which must not close the tooltip.
  const pressedTooltip = useRef(false);

  const show = () => {
    // A modal dialog is in the top layer: the tooltip of a term inside it has to be there too.
    setContainer(triggerRef.current?.closest('dialog') ?? null);
    setOpen(true);
  };
  const hide = useCallback(() => {
    setOpen(false);
    setStyle(UNPLACED);
  }, []);

  // Measures the tooltip at its final width and places it. This runs before the browser paints,
  // so the tooltip is never seen where the document flow would leave it.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!open || !trigger || !tooltip) return;
    const viewport = viewportSize();
    const width = tooltipWidth(viewport.width);
    tooltip.style.width = `${width}px`;
    tooltip.style.maxHeight = '';
    const rect = trigger.getBoundingClientRect();
    const placement = placeTooltip({
      anchor: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      height: tooltip.offsetHeight,
      viewport,
    });
    setStyle({
      left: placement.left,
      top: placement.top,
      width: placement.width,
      maxHeight: placement.maxHeight ?? undefined,
    });
  }, [open, container]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (anchor.current?.contains(target) || tooltipRef.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape closes the tooltip only, not a dialog or sheet the term may be in.
      event.preventDefault();
      event.stopPropagation();
      hide();
    };
    // The tooltip is fixed to the viewport, so it closes when the content scrolls under it.
    const onScroll = (event: Event) => {
      if (event.target !== tooltipRef.current) hide();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide, anchor]);

  const inTooltip = (target: EventTarget) =>
    target instanceof Node && tooltipRef.current?.contains(target) === true;

  const tooltip = (
    <span
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      className="term__tooltip"
      style={style}
      hidden={!open}
      onPointerDown={() => {
        pressedTooltip.current = true;
      }}
    >
      <strong className="term__name">{tr(entry.term)}</strong>
      {tr(entry.definition)}
    </span>
  );

  return (
    <span
      ref={anchor}
      className="term"
      // The press and the click are read here and not on the button: on a touch screen the term
      // has an invisible 44 px area around the word (glossary.css) that belongs to this element.
      onPointerDown={(event) => {
        if (inTooltip(event.target)) return;
        press.current = { type: event.pointerType, wasOpen: open };
      }}
      onClick={(event) => {
        // The tooltip is a React child through its portal: its events bubble to here.
        if (inTooltip(event.target)) return;
        const pressed = press.current;
        press.current = null;
        // A mouse click keeps the tooltip that hover or focus opened. A tap or a key toggles:
        // on a touch screen there is no hover to bring it up or to dismiss it.
        if (pressed?.type === 'mouse') show();
        else if (pressed ? pressed.wasOpen : open) hide();
        else show();
      }}
      // Hover is for the mouse only. A touch screen also reports a tap as the pointer entering
      // and leaving (and as mouse events after it), which would close what the tap just opened.
      onPointerEnter={(event) => {
        if (hovers(event.pointerType)) show();
      }}
      onPointerLeave={(event) => {
        if (hovers(event.pointerType)) hide();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="term__trigger"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onFocus={show}
        onBlur={() => {
          if (pressedTooltip.current) pressedTooltip.current = false;
          else hide();
        }}
      >
        {children ?? tr(entry.term)}
      </button>
      {createPortal(tooltip, container ?? document.body)}
    </span>
  );
}
