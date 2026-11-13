import { registerSW } from 'virtual:pwa-register';
import { usePwaStatus } from '../ui/shell/pwaStatus';

/**
 * Registers the service worker that makes the app work offline. The registration is in prompt
 * mode (`registerType: 'prompt'` in vite.config.ts): a new version waits until the player
 * presses "Atualizar" in the notice, so a stage in progress is never reloaded under them.
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
