import { create } from 'zustand';

export type PwaNotice = 'offlineReady' | 'updateAvailable' | null;

interface PwaState {
  notice: PwaNotice;
  /** Activates the waiting service worker and reloads the page. */
  applyUpdate: (() => void) | null;
  dismiss: () => void;
}

/** Service worker status shown by `PwaNotice`. Written by `src/pwa.ts`. */
export const usePwaStatus = create<PwaState>((set) => ({
  notice: null,
  applyUpdate: null,
  dismiss: () => set({ notice: null }),
}));
