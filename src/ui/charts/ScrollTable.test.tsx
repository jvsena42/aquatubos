import { act, fireEvent, render, screen } from '@testing-library/react';
import { ScrollTable } from './ScrollTable';

function metrics(element: HTMLElement, values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
}

function setup() {
  render(
    <ScrollTable label="Trechos" className="results__wrap">
      <table>
        <thead>
          <tr>
            <th className="sticky-col">Trecho</th>
            <th>Vazão</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="sticky-col">T1</th>
            <td>10,5</td>
          </tr>
        </tbody>
      </table>
    </ScrollTable>,
  );
  const scroller = screen.getByRole('region', { name: 'Trechos' });
  return { scroller, frame: scroller.parentElement! };
}

describe('ScrollTable', () => {
  it('wraps the table in a labelled, focusable scroller inside the frame', () => {
    const { scroller, frame } = setup();
    expect(frame).toHaveClass('hscroll', 'results__wrap');
    expect(scroller).toHaveClass('hscroll__scroller', 'table-wrap');
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(scroller).toContainElement(screen.getByRole('table'));
    // The sticky rules of charts.css apply to these cells and to the header row.
    expect(scroller.querySelectorAll('.sticky-col')).toHaveLength(2);
    expect(scroller.querySelector('thead')).not.toBeNull();
  });

  it('starts with no fade', () => {
    const { frame } = setup();
    expect(frame).toHaveAttribute('data-fade-start', 'false');
    expect(frame).toHaveAttribute('data-fade-end', 'false');
  });

  it('shows the end fade while columns are hidden and drops it at the end of the scroll', () => {
    const { scroller, frame } = setup();
    metrics(scroller, { clientWidth: 308, scrollWidth: 983, scrollLeft: 0 });
    fireEvent.scroll(scroller);
    expect(frame).toHaveAttribute('data-fade-start', 'false');
    expect(frame).toHaveAttribute('data-fade-end', 'true');

    metrics(scroller, { scrollLeft: 300 });
    fireEvent.scroll(scroller);
    expect(frame).toHaveAttribute('data-fade-start', 'true');
    expect(frame).toHaveAttribute('data-fade-end', 'true');

    metrics(scroller, { scrollLeft: 675 });
    fireEvent.scroll(scroller);
    expect(frame).toHaveAttribute('data-fade-start', 'true');
    expect(frame).toHaveAttribute('data-fade-end', 'false');
  });

  it('tells the style sheet how wide the sticky column is', () => {
    const { scroller, frame } = setup();
    metrics(scroller.querySelector<HTMLElement>('.sticky-col')!, { offsetWidth: 57 });
    fireEvent.scroll(scroller);
    expect(frame.style.getPropertyValue('--hscroll-sticky')).toBe('57px');
  });

  it('measures when the frame or the table is resized', () => {
    const observed: Element[] = [];
    let notify = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {}
      },
    );
    try {
      const { scroller, frame } = setup();
      expect(observed).toEqual([scroller, screen.getByRole('table')]);
      metrics(scroller, { clientWidth: 308, scrollWidth: 983, scrollLeft: 0 });
      expect(frame).toHaveAttribute('data-fade-end', 'false');
      act(() => notify());
      expect(frame).toHaveAttribute('data-fade-end', 'true');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
