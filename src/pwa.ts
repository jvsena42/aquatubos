import { registerSW } from 'virtual:pwa-register';
import { usePwaStatus } from './ui/shell/pwaStatus';

/**
 * Registers the service worker that makes the app work offline. With
 * `registerType: 'autoUpdate'` a new version activates by itself and reloads the page; the
 * "update available" notice only appears if the registration is switched to prompt mode.
 */
export function registerServiceWorker(): void {
  const updateSW = registerSW({
    immediate: true,
    onOfflineReady: () => usePwaStatus.setState({ notice: 'offlineReady' }),
    onNeedRefresh: () =>
      usePwaStatus.setState({
        notice: 'updateAvailable',
        applyUpdate: () => void updateSW(true),
      }),
  });
}
