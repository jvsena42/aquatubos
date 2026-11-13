import { useState, type ReactNode } from 'react';
import { useTr } from '../../i18n';
import { usePwaInstall } from '../../pwa/install';
import { Dialog } from './Dialog';
import './install.css';

export const installStrings = {
  install: { pt: 'Instalar app', en: 'Install app' },
  iosTitle: { pt: 'Instalar no iPhone ou iPad', en: 'Install on iPhone or iPad' },
  iosShare: { pt: 'Toque em Compartilhar', en: 'Tap Share' },
  iosAdd: { pt: 'Adicionar à Tela de Início', en: 'Add to Home Screen' },
  iosConfirm: { pt: 'Toque em Adicionar', en: 'Tap Add' },
  iosNote: {
    pt: 'No Safari, o botão Compartilhar fica na barra inferior; em outros navegadores, no menu.',
    en: 'In Safari the Share button is in the bottom bar; in other browsers it is in the menu.',
  },
  close: { pt: 'Entendi', en: 'Got it' },
} as const;

function IconInstall() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4v10m0 0-4-4m4 4 4-4M5 18h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The iOS share glyph: a box with an arrow pointing up. */
function IconShare() {
  return (
    <svg className="install__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M7 11H6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAddToHome() {
  return (
    <svg className="install__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconConfirm() {
  return (
    <svg className="install__glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface InstallAction {
  /** False when the app is installed, runs standalone, or the browser has no install route. */
  available: boolean;
  label: string;
  /** Shows the native prompt (Chromium) or opens the iOS instructions. */
  start: () => void;
  /** Render this once next to the control; it holds the iOS instructions dialog. */
  dialog: ReactNode;
}

/**
 * Install entry point for buttons and menu items. Chromium: native prompt. iPhone/iPad: a short
 * sheet with the Share → Add to Home Screen steps. Anything else: not available.
 */
export function useInstallAction(): InstallAction {
  const tr = useTr();
  const { mode, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  const start = () => {
    if (mode === 'prompt') void promptInstall();
    else if (mode === 'ios') setOpen(true);
  };

  const dialog = (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={tr(installStrings.iosTitle)}
      footer={
        <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
          {tr(installStrings.close)}
        </button>
      }
    >
      <ol className="install__steps">
        <li>
          <IconShare />
          <span>{tr(installStrings.iosShare)}</span>
        </li>
        <li>
          <IconAddToHome />
          <span>{tr(installStrings.iosAdd)}</span>
        </li>
        <li>
          <IconConfirm />
          <span>{tr(installStrings.iosConfirm)}</span>
        </li>
      </ol>
      <p className="muted install__note">{tr(installStrings.iosNote)}</p>
    </Dialog>
  );

  return { available: mode !== 'none', label: tr(installStrings.install), start, dialog };
}

/** "Instalar app" button. Renders nothing where installing is not possible or already done. */
export function InstallButton({ className = 'btn' }: { className?: string }) {
  const action = useInstallAction();
  if (!action.available) return null;
  return (
    <>
      <button type="button" className={className} onClick={action.start}>
        <IconInstall />
        {action.label}
      </button>
      {action.dialog}
    </>
  );
}
