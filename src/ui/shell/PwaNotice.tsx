import { useEffect } from 'react';
import { useTr } from '../../i18n';
import { IconCheck, IconClose, IconInfo } from './icons';
import { usePwaStatus } from './pwaStatus';
import { shellStrings } from './strings';

const OFFLINE_READY_TIMEOUT_MS = 8000;

/** Small notice in the corner: "ready to work offline" or "new version available". */
export function PwaNotice() {
  const tr = useTr();
  const notice = usePwaStatus((s) => s.notice);
  const applyUpdate = usePwaStatus((s) => s.applyUpdate);
  const dismiss = usePwaStatus((s) => s.dismiss);

  useEffect(() => {
    if (notice !== 'offlineReady') return;
    const timer = window.setTimeout(dismiss, OFFLINE_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);

  return (
    <div className="pwa-notice" role="status" aria-live="polite">
      {notice && (
        <div className="pwa-notice__box">
          {notice === 'offlineReady' ? <IconCheck /> : <IconInfo />}
          <span>
            {tr(
              notice === 'offlineReady' ? shellStrings.offlineReady : shellStrings.updateAvailable,
            )}
          </span>
          {notice === 'updateAvailable' && applyUpdate && (
            <button type="button" className="btn btn--sm btn--primary" onClick={applyUpdate}>
              {tr(shellStrings.reload)}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            aria-label={tr(shellStrings.dismiss)}
            onClick={dismiss}
          >
            <IconClose />
          </button>
        </div>
      )}
    </div>
  );
}
