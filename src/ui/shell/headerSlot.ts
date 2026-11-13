import { useSyncExternalStore } from 'react';

/**
 * The place in the app header where the open stage shows its name, its numbers (on phones) and
 * the briefing button. The header owns the element and registers it here; the stage screen
 * renders into it with a portal, so the top bar is one row and the stage keeps its own state.
 */
let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** Ref callback for the element in the header. */
export function setHeaderSlot(element: HTMLElement | null): void {
  if (slot === element) return;
  slot = element;
  for (const listener of listeners) listener();
}

/** The element right now; for layout effects that run in the commit that mounted the header. */
export function getHeaderSlot(): HTMLElement | null {
  return slot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The element, or null while no header with a stage slot is mounted (component tests). */
export function useHeaderSlot(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  );
}
