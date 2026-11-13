import { useEffect, useReducer, useState, type ReactNode } from 'react';
import type { LocalizedText } from '../../engine/types';
import { useTr } from '../../i18n';
import { SCENARIOS } from '../../scenarios';
import { isUnlocked, useAppStore } from '../../state/store';
import { CalcPanel, focusDnBar } from '../panels/CalcPanel';
import { calcStrings } from '../panels/calcStrings';
import { ChecksPanel } from '../panels/ChecksPanel';
import { checksStrings } from '../panels/checksStrings';
import { IconCheck, IconClose, IconError, IconNext, IconPending, IconStale } from '../shell/icons';
import { shellStrings } from '../shell/strings';
import { Stars } from '../shell/Stars';
import { BottomSheet } from './BottomSheet';
import { initialSheetState, sheetReducer, type Detent, type SheetSection } from './sheetState';
import { stageStrings } from './strings';

const SECTIONS: SheetSection[] = ['calc', 'checks'];

/** Name of the handle button: what its next press does. */
const HANDLE_LABEL: Record<Detent, LocalizedText> = {
  peek: stageStrings.sheetExpand,
  half: stageStrings.sheetExpandFull,
  full: stageStrings.sheetCollapse,
};

interface StageSheetProps {
  /** Phone held sideways or tablet in landscape: a panel beside the map, not a sheet over it. */
  side: boolean;
  /** Height of the half detent as a fraction of the viewport (see `SHEET_HALF`). */
  half?: number;
}

/**
 * Calculation panel and checks of the phone and tablet layouts, in a bottom sheet with the
 * "Calcular / Verificar" button in its bar. The sheet follows the game: picking an element
 * brings its calculation up, a failed verification brings the checks, a passed one gets out of
 * the way of the map.
 */
export function StageSheet({ side, half }: StageSheetProps) {
  const tr = useTr();
  const scenario = useAppStore((s) => s.scenario);
  const selection = useAppStore((s) => s.selection);
  const diameters = useAppStore((s) => s.diameters);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const solving = useAppStore((s) => s.solving);
  const progress = useAppStore((s) => s.progress);
  const verify = useAppStore((s) => s.verify);
  const openStage = useAppStore((s) => s.openStage);
  const verifiedAt = useAppStore((s) => s.verifiedAt);
  const [state, dispatch] = useReducer(sheetReducer, initialSheetState);
  /** The verification whose "stage passed" notice the player closed. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(
    () =>
      useAppStore.subscribe((now, before) => {
        // `select` stores a new object each time, so picking the same element again counts.
        if (now.selection && now.selection !== before.selection) dispatch({ type: 'selected' });
        if (now.verifiedAt !== null && now.verifiedAt !== before.verifiedAt && now.evaluation) {
          dispatch({ type: 'verified', passed: now.evaluation.passed });
          // The side panel is always open: it shows the result, passed or not.
          if (side) dispatch({ type: 'section', section: 'checks' });
        }
      }),
    [side],
  );

  if (!scenario) return null;

  const hasSelection = selection !== null;
  const passedNow = evaluation !== null && !stale && evaluation.passed;

  const selectionName = ((): string | null => {
    if (!selection) return null;
    const { type, id } = selection;
    const pipe = scenario.pipes.find((p) => p.id === id);
    if (type === 'pipe' && pipe) {
      return `${tr(calcStrings.pipe(id))} · DN ${diameters[id] ?? pipe.initialDN}`;
    }
    if (type === 'pump' && scenario.pumps.some((p) => p.id === id)) return tr(calcStrings.pump(id));
    if (scenario.nodes.some((n) => n.id === id)) return tr(calcStrings.node(id));
    if (scenario.reservoirs.some((r) => r.id === id)) return tr(calcStrings.reservoir(id));
    return null;
  })();

  const checksSummary = ((): { icon: ReactNode; text: string } => {
    if (!evaluation) {
      return {
        icon: <IconPending />,
        text: tr(solving ? checksStrings.solving : checksStrings.notVerified),
      };
    }
    if (stale) return { icon: <IconStale />, text: tr(checksStrings.stale) };
    if (evaluation.passed) return { icon: <IconCheck />, text: tr(checksStrings.passed) };
    return {
      icon: <IconError />,
      text: tr(stageStrings.issueCount(evaluation.report.issues.length)),
    };
  })();

  // Closed, the bar names the selection, or the state of the checks when nothing is selected.
  // Open, it shows the one the panel is not showing, so both stay in sight.
  const open = side || state.detent !== 'peek';
  const showSelection = selectionName !== null && (!open || state.section === 'checks');
  const summary = showSelection ? (
    <>
      <span className="sheet__kicker">{tr(stageStrings.calcPanel)}</span>
      <span className="sheet__value">{selectionName}</span>
    </>
  ) : (
    <>
      <span className="sheet__kicker">{tr(stageStrings.checksPanel)}</span>
      <span className="sheet__value" data-status={passedNow ? 'ok' : undefined}>
        {checksSummary.icon}
        {checksSummary.text}
      </span>
    </>
  );

  const summaryText = showSelection
    ? `${tr(stageStrings.calcPanel)}: ${selectionName}`
    : `${tr(stageStrings.checksPanel)}: ${checksSummary.text}`;

  const tools = (
    <div
      className="segmented sheet__switch"
      role="group"
      aria-label={tr(stageStrings.sheetSection)}
    >
      {SECTIONS.map((section) => (
        <button
          key={section}
          type="button"
          aria-pressed={state.section === section}
          onClick={() => dispatch({ type: 'section', section })}
        >
          {tr(section === 'calc' ? stageStrings.calcPanel : stageStrings.checksPanel)}
        </button>
      ))}
    </div>
  );

  const action = (
    <button
      type="button"
      className="btn btn--primary sheet__verify"
      disabled={solving}
      data-stale={stale && !solving ? 'true' : undefined}
      onClick={() => void verify()}
    >
      {stale && !solving && <IconStale />}
      {tr(solving ? stageStrings.solving : stale ? stageStrings.reverify : stageStrings.verify)}
    </button>
  );

  // After a pass the sheet is closed, so the way to the next stage is offered above the bar.
  const next = SCENARIOS.find((s) => s.order === scenario.order + 1);
  const notice = passedNow && !solving && verifiedAt !== null && verifiedAt !== dismissedAt && (
    <div className="sheet__passed" role="status">
      <span className="sheet__passed-text">
        <IconCheck />
        {tr(stageStrings.passedNotice)}
        <Stars value={evaluation.stars} />
      </span>
      {next && isUnlocked(next, progress) && (
        <button type="button" className="btn btn--sm" onClick={() => void openStage(next.id)}>
          {tr(checksStrings.nextStage)}
          <IconNext />
        </button>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--sm sheet__passed-close"
        aria-label={tr(shellStrings.dismiss)}
        onClick={() => setDismissedAt(verifiedAt)}
      >
        <IconClose />
      </button>
    </div>
  );

  return (
    <BottomSheet
      mode={side ? 'side' : 'sheet'}
      detent={state.detent}
      half={half}
      label={tr(stageStrings.sidePanel)}
      handleLabel={tr(HANDLE_LABEL[state.detent])}
      collapseLabel={tr(stageStrings.sheetClose)}
      summary={summary}
      summaryText={summaryText}
      tools={tools}
      action={action}
      notice={notice}
      onCycle={() => dispatch({ type: 'cycle', hasSelection })}
      onSnap={(detent) => dispatch({ type: 'snap', detent, hasSelection })}
      onCollapse={() => dispatch({ type: 'collapse' })}
    >
      {state.section === 'calc' ? (
        <CalcPanel
          onChangeDn={() => {
            // The picker is in the bar under the map: get the sheet out of its way and go there.
            dispatch({ type: 'collapse' });
            focusDnBar();
          }}
        />
      ) : (
        <ChecksPanel />
      )}
    </BottomSheet>
  );
}
