import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { TermId } from './glossary';

interface Occurrence {
  anchor: RefObject<HTMLElement | null>;
  setRepeat: (repeat: boolean) => void;
}

/** The occurrences of each term mounted inside one scope. */
class TermRegistry {
  private readonly terms = new Map<TermId, Set<Occurrence>>();

  add(id: TermId, occurrence: Occurrence): () => void {
    let set = this.terms.get(id);
    if (!set) {
      set = new Set();
      this.terms.set(id, set);
    }
    set.add(occurrence);
    this.update(id);
    return () => {
      set.delete(occurrence);
      this.update(id);
    };
  }

  /** The occurrence that comes first in the document is the interactive one. */
  private update(id: TermId): void {
    let first: Occurrence | null = null;
    const all = [...(this.terms.get(id) ?? [])];
    for (const occurrence of all) {
      const element = occurrence.anchor.current;
      const leader = first?.anchor.current;
      if (
        !first ||
        (element &&
          leader &&
          element.compareDocumentPosition(leader) & Node.DOCUMENT_POSITION_FOLLOWING)
      ) {
        first = occurrence;
      }
    }
    for (const occurrence of all) occurrence.setRepeat(occurrence !== first);
  }
}

const ScopeContext = createContext<TermRegistry | null>(null);

/**
 * Wrap a panel in a TermScope so that only the first occurrence of each glossary term inside it
 * is underlined and interactive; repeats read as plain text. Renders a `display: contents`
 * wrapper, so it does not affect layout. A scope inside another counts its terms on its own.
 *
 * Which occurrence is first is decided by position in the document after every mount and
 * unmount (in a layout effect, so before the browser paints), not by render order: a term that
 * appears later in time but earlier on the page takes over.
 */
export function TermScope({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new TermRegistry());
  return (
    <ScopeContext.Provider value={registry}>
      <div className="term-scope" style={{ display: 'contents' }}>
        {children}
      </div>
    </ScopeContext.Provider>
  );
}

/**
 * For Term: whether this occurrence repeats a term already shown earlier in the enclosing scope.
 * Always false outside a scope. `anchor` is the element the occurrence renders.
 */
export function useTermRepeat(id: TermId, anchor: RefObject<HTMLElement | null>): boolean {
  const registry = useContext(ScopeContext);
  const [repeat, setRepeat] = useState(false);
  const occurrence = useRef<Occurrence>({ anchor, setRepeat });
  useLayoutEffect(() => {
    if (!registry) return;
    return registry.add(id, occurrence.current);
  }, [registry, id]);
  return registry !== null && repeat;
}
