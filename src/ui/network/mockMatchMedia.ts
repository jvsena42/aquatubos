/**
 * Test helper: installs a `window.matchMedia` that matches the given queries (jsdom has none).
 * Returns a function that removes it.
 */
export function mockMatchMedia(matching: readonly string[]): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}
