/**
 * Test helper: installs a `window.matchMedia` whose queries match by a rule the test controls.
 * jsdom has no matchMedia, which the app reads as "not a phone, motion allowed".
 */
export interface MatchMediaMock {
  /** Changes which queries match and notifies the listeners. */
  set: (matches: (query: string) => boolean) => void;
  restore: () => void;
}

export function mockMatchMedia(matches: (query: string) => boolean): MatchMediaMock {
  const original = window.matchMedia;
  let rule = matches;
  const listeners = new Set<() => void>();
  window.matchMedia = ((query: string) =>
    ({
      media: query,
      get matches() {
        return rule(query);
      },
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      addListener: (listener: () => void) => listeners.add(listener),
      removeListener: (listener: () => void) => listeners.delete(listener),
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  return {
    set: (next) => {
      rule = next;
      for (const listener of [...listeners]) listener();
    },
    restore: () => {
      window.matchMedia = original;
    },
  };
}
