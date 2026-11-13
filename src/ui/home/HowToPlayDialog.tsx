import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTr } from '../../i18n';
import { Dialog } from '../shell/Dialog';
import { IconBack, IconNext } from '../shell/icons';
import { HOW_TO_STEPS, howToStrings } from './strings';

const STAR = 'm0-17 5 10.4 11.4 1.6-8.3 8 2 11.3L0 8.9l-10.1 5.4 2-11.3-8.3-8 11.4-1.6Z';

/** One small drawing per step, in the style of the stage map. */
const ART: readonly ReactNode[] = [
  // A pipe between two nodes and the diameter options, one of them chosen.
  <>
    <path className="ht-pipe" d="M36 38H204" />
    <path className="ht-water" d="M36 38H204" />
    <circle className="ht-node" cx="36" cy="38" r="9" />
    <circle className="ht-node" cx="204" cy="38" r="9" />
    <rect className="ht-chip" x="30" y="72" width="52" height="30" rx="6" />
    <rect className="ht-chip ht-chip--on" x="94" y="72" width="52" height="30" rx="6" />
    <rect className="ht-chip" x="158" y="72" width="52" height="30" rx="6" />
    <circle className="ht-bore" cx="56" cy="87" r="5" />
    <circle className="ht-bore ht-bore--on" cx="120" cy="87" r="8" />
    <circle className="ht-bore" cx="184" cy="87" r="11" />
  </>,
  // The verify button and the solved network with flow arrows.
  <>
    <rect className="ht-button" x="56" y="16" width="128" height="34" rx="8" />
    <path className="ht-on-button" d="M76 33h52M150 27l8 6-8 6" />
    <path className="ht-pipe" d="M36 86H204" />
    <path className="ht-water" d="M36 86H204" />
    <path className="ht-arrow" d="M84 79l8 7-8 7M144 79l8 7-8 7" />
    <circle className="ht-node" cx="36" cy="86" r="9" />
    <circle className="ht-node" cx="204" cy="86" r="9" />
  </>,
  // Houses with lit windows and a list of checks.
  <>
    <path className="ht-line" d="M14 100H116" />
    <rect className="ht-body" x="22" y="64" width="38" height="36" />
    <path className="ht-roof" d="M16 64 41 42 66 64Z" />
    <rect className="ht-lit" x="34" y="74" width="14" height="12" />
    <rect className="ht-body" x="72" y="64" width="38" height="36" />
    <path className="ht-roof ht-roof--alt" d="M66 64 91 42 116 64Z" />
    <rect className="ht-lit" x="84" y="74" width="14" height="12" />
    <rect className="ht-chip" x="134" y="22" width="92" height="82" rx="6" />
    <path className="ht-ok" d="m146 40 5 5 8-9M146 63l5 5 8-9M146 86l5 5 8-9" />
    <path className="ht-line" d="M170 41h44M170 64h36M170 87h44" />
  </>,
  // Stars and a lower cost.
  <>
    <path className="ht-star" transform="translate(64 44)" d={STAR} />
    <path className="ht-star" transform="translate(120 44)" d={STAR} />
    <path className="ht-star ht-star--off" transform="translate(176 44)" d={STAR} />
    <rect className="ht-chip" x="76" y="78" width="88" height="30" rx="15" />
    <text className="ht-text" x="110" y="94">
      R$
    </text>
    <path className="ht-ok" d="M142 86v14m-6-6 6 6 6-6" />
  </>,
];

/**
 * The dialog gives its first focus to the element with the `autofocus` attribute, which React
 * does not write to the DOM.
 */
const markAutofocus = (button: HTMLButtonElement | null) => button?.setAttribute('autofocus', '');

function Steps({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const [index, setIndex] = useState(0);
  const total = HOW_TO_STEPS.length;
  const step = HOW_TO_STEPS[index]!;
  const last = index === total - 1;
  const go = (next: number) => setIndex(Math.min(total - 1, Math.max(0, next)));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else return;
    event.preventDefault();
  };

  return (
    // Arrow keys are a shortcut; the buttons below do the same.
    <div className="howto" onKeyDown={onKeyDown}>
      <div className="howto__step" aria-live="polite">
        <svg className="howto__art" viewBox="0 0 240 120" aria-hidden="true" focusable="false">
          {ART[index]}
        </svg>
        <p className="howto__count muted">{tr(howToStrings.stepOf(index + 1, total))}</p>
        <h3 className="howto__title">{tr(step.title)}</h3>
        <p className="howto__text">{tr(step.text)}</p>
      </div>
      <div className="howto__nav">
        <button type="button" className="btn" disabled={index === 0} onClick={() => go(index - 1)}>
          <IconBack />
          {tr(howToStrings.previous)}
        </button>
        <ol className="howto__dots" aria-label={tr(howToStrings.steps)}>
          {HOW_TO_STEPS.map((item, n) => (
            <li key={n}>
              <button
                type="button"
                className="howto__dot"
                aria-label={`${tr(howToStrings.stepOf(n + 1, total))}: ${tr(item.title)}`}
                aria-current={n === index ? 'step' : undefined}
                onClick={() => go(n)}
              />
            </li>
          ))}
        </ol>
        {/* One button for both cases, so it keeps the focus from the first step to the last. */}
        <button
          ref={markAutofocus}
          type="button"
          className="btn btn--primary"
          onClick={last ? onClose : () => go(index + 1)}
        >
          {tr(last ? howToStrings.done : howToStrings.next)}
          {!last && <IconNext />}
        </button>
      </div>
    </div>
  );
}

/** Four-step walkthrough of a stage. Opens on the first step every time. */
export function HowToPlayDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tr = useTr();
  return (
    <Dialog open={open} onClose={onClose} title={tr(howToStrings.title)}>
      <Steps onClose={onClose} />
    </Dialog>
  );
}
