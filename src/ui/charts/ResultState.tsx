import type { ReactNode } from 'react';
import { useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { IconInfo, IconStale } from '../shell/icons';
import { resultStrings } from './strings';
import './charts.css';

/** Shown by a result view when there is nothing to show yet. */
export function ResultHint({ children }: { children?: ReactNode }) {
  const tr = useTr();
  const solving = useAppStore((s) => s.solving);
  return (
    <p className="result-hint" role="status">
      <IconInfo />
      <span>{children ?? tr(solving ? resultStrings.solving : resultStrings.noResult)}</span>
    </p>
  );
}

/**
 * Wraps the content of a result view. When the design changed after the last calculation the
 * content is dimmed and a note says the values are outdated.
 */
export function ResultBody({ className, children }: { className?: string; children: ReactNode }) {
  const tr = useTr();
  const stale = useAppStore((s) => s.stale);
  return (
    <div className={className}>
      {stale && (
        <p className="result-stale" role="status">
          <IconStale />
          <span>{tr(resultStrings.stale)}</span>
        </p>
      )}
      <div className={stale ? 'result-content result-content--stale' : 'result-content'}>
        {children}
      </div>
    </div>
  );
}
