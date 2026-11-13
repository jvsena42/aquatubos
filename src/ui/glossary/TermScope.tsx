import type { ReactNode } from 'react';

/**
 * Wrap a panel in a TermScope so that only the first occurrence of each glossary term inside it
 * is underlined; repeats read as plain text. Renders a `display: contents` wrapper, so it does
 * not affect layout.
 */
export function TermScope({ children }: { children: ReactNode }) {
  return (
    <div className="term-scope" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
