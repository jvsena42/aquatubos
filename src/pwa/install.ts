import { create } from 'zustand';

/** The non-standard event Chromium fires when the app can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * How the app can be installed in this browser:
 * `prompt`  Chromium offered the native install prompt (desktop Chrome/Edge, Android)
 * `ios`     iPhone/iPad: no prompt exists; the player adds it from the Share menu
 * `none`    already installed or running standalone, or the browser has no install route
 */
export type InstallMode = 'prompt' | 'ios' | 'none';

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  standalone: boolean;
  ios: boolean;
}

export const useInstallStore = create<InstallState>(() => ({
  deferred: null,
  installed: false,
  standalone: false,
  ios: false,
}));

type NavigatorLike = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & {
  standalone?: boolean;
};

/**
 * iPhone, iPod or iPad. iPadOS reports itself as a Mac, so a "Mac" with a touch screen counts.
 * Every browser on iOS can add to the Home Screen from the Share menu (iOS 16.4+), so the
 * browser brand is not checked.
 */
export function detectIos(nav: NavigatorLike): boolean {
  if (/iPhone|iPad|iPod/i.test(nav.userAgent)) return true;
  return /Mac/i.test(nav.platform ?? '') && (nav.maxTouchPoints ?? 0) > 1;
}

/** Running from the home screen / as an installed app. */
export function detectStandalone(win: Pick<Window, 'matchMedia'>, nav: NavigatorLike): boolean {
  if (nav.standalone === true) return true;
  return (
    typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches
  );
}

export function installMode(state: InstallState): InstallMode {
  if (state.installed || state.standalone) return 'none';
  if (state.deferred) return 'prompt';
  return state.ios ? 'ios' : 'none';
}

let initialised = false;

/**
 * Starts listening for install events. Call once, before the app renders, because Chromium may
 * fire `beforeinstallprompt` early and it is not fired again.
 */
export function initPwaInstall(win: Window = window): void {
  if (initialised) return;
  initialised = true;
  useInstallStore.setState({
    ios: detectIos(win.navigator),
    standalone: detectStandalone(win, win.navigator),
  });
  win.addEventListener('beforeinstallprompt', (event) => {
    // Keep the event so the in-app button can show the prompt later.
    event.preventDefault();
    useInstallStore.setState({ deferred: event as BeforeInstallPromptEvent });
  });
  win.addEventListener('appinstalled', () => {
    useInstallStore.setState({ installed: true, deferred: null });
  });
  if (typeof win.matchMedia === 'function') {
    win
      .matchMedia('(display-mode: standalone)')
      .addEventListener?.('change', (event) =>
        useInstallStore.setState({ standalone: event.matches }),
      );
  }
}

/** For tests. */
export function resetPwaInstall(): void {
  initialised = false;
  useInstallStore.setState({ deferred: null, installed: false, standalone: false, ios: false });
}

/**
 * Shows the native install prompt. Resolves to the player's choice, or `unavailable` when there
 * is no prompt to show. A prompt event can be used once, so it is dropped afterwards.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const { deferred } = useInstallStore.getState();
  if (!deferred) return 'unavailable';
  useInstallStore.setState({ deferred: null });
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') useInstallStore.setState({ installed: true });
  return outcome;
}

export interface PwaInstall {
  mode: InstallMode;
  /** True when the native prompt can be shown now. */
  canPrompt: boolean;
  promptInstall: typeof promptInstall;
  /** The app was installed during this session. */
  installed: boolean;
  isStandalone: boolean;
  isIos: boolean;
}

export function usePwaInstall(): PwaInstall {
  const state = useInstallStore();
  return {
    mode: installMode(state),
    canPrompt: state.deferred !== null,
    promptInstall,
    installed: state.installed,
    isStandalone: state.standalone,
    isIos: state.ios,
  };
}
