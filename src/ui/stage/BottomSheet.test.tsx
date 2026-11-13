import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { BottomSheet } from './BottomSheet';
import { sheetReducer, type Detent, type SheetState } from './sheetState';

const LABEL: Record<Detent, string> = {
  peek: 'Painel: expandir',
  half: 'Painel: expandir tudo',
  full: 'Painel: recolher',
};

function Example({
  start = 'peek',
  mode = 'sheet',
  onVerify = () => undefined,
}: {
  start?: Detent;
  mode?: 'sheet' | 'side';
  onVerify?: () => void;
}) {
  const initial: SheetState = { detent: start, section: 'calc' };
  const [state, dispatch] = useReducer(sheetReducer, initial);
  return (
    <div data-testid="frame">
      <BottomSheet
        mode={mode}
        detent={state.detent}
        label="Cálculo e verificações"
        handleLabel={LABEL[state.detent]}
        collapseLabel="Recolher painel"
        summary={<b>Trecho T2</b>}
        summaryText="Trecho T2 · DN 75"
        tools={<button type="button">Seção</button>}
        action={
          <button type="button" onClick={onVerify}>
            Calcular
          </button>
        }
        notice={<p>Aviso</p>}
        onCycle={() => dispatch({ type: 'cycle', hasSelection: true })}
        onSnap={(detent) => dispatch({ type: 'snap', detent, hasSelection: true })}
        onCollapse={() => dispatch({ type: 'collapse' })}
      >
        <button type="button">Conteúdo</button>
      </BottomSheet>
    </div>
  );
}

const sheet = () => screen.getByRole('region', { name: 'Cálculo e verificações' });
const handle = () => sheet().querySelector<HTMLButtonElement>('.sheet__handle')!;
const panel = () => sheet().querySelector<HTMLElement>('.sheet__panel')!;

/** Gives the sheet a layout: a 800 px frame in a 1000 px window, a 64 px bar. */
function layout() {
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  Object.defineProperty(screen.getByTestId('frame'), 'clientHeight', { value: 800 });
  const height = () => {
    const inline = parseFloat(sheet().style.height);
    if (!Number.isNaN(inline)) return inline;
    return { peek: 64, half: 500, full: 800 }[sheet().dataset.detent as Detent];
  };
  sheet().getBoundingClientRect = () => ({ height: height() }) as DOMRect;
  panel().getBoundingClientRect = () => ({ height: height() - 64 }) as DOMRect;
}

/** Drags `target` from y `from` to `to` in equal steps `stepMs` apart, then lifts. */
function drag(target: Element, from: number, to: number, stepMs: number, holdMs = 0) {
  const steps = 5;
  let time = 1000;
  const at = (type: string, y: number) => {
    const event = new PointerEvent(type, { bubbles: true, pointerId: 1, clientY: y, button: 0 });
    Object.defineProperty(event, 'timeStamp', { value: time });
    fireEvent(target, event);
  };
  at('pointerdown', from);
  for (let i = 1; i <= steps; i++) {
    time += stepMs;
    at('pointermove', from + ((to - from) * i) / steps);
  }
  time += holdMs || 1;
  at('pointerup', to);
}

describe('BottomSheet', () => {
  it('is a labelled region that is closed at peek', () => {
    render(<Example />);
    expect(sheet()).toHaveAttribute('data-detent', 'peek');
    expect(handle()).toHaveAccessibleName('Painel: expandir');
    expect(handle()).toHaveAccessibleDescription('Trecho T2 · DN 75');
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
    expect(handle()).toHaveAttribute('aria-controls', panel().id);
    // The closed panel is out of the tab order and of the accessibility tree.
    expect(panel()).toHaveAttribute('inert');
    expect(screen.queryByRole('button', { name: 'Conteúdo' })).not.toBeInTheDocument();
    expect(screen.getByText('Aviso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeInTheDocument();
  });

  it('steps through the detents with the handle button', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(handle());
    expect(sheet()).toHaveAttribute('data-detent', 'half');
    expect(handle()).toHaveAccessibleName('Painel: expandir tudo');
    expect(handle()).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).not.toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Conteúdo' })).toBeInTheDocument();
    expect(screen.queryByText('Aviso')).not.toBeInTheDocument();

    await user.click(handle());
    expect(sheet()).toHaveAttribute('data-detent', 'full');
    expect(handle()).toHaveAccessibleName('Painel: recolher');
    await user.click(handle());
    expect(sheet()).toHaveAttribute('data-detent', 'peek');
  });

  it('works from the keyboard: Enter and Space on the handle, Escape to put it away', async () => {
    const user = userEvent.setup();
    render(<Example />);
    handle().focus();
    await user.keyboard('{Enter}');
    expect(sheet()).toHaveAttribute('data-detent', 'half');
    await user.keyboard(' ');
    expect(sheet()).toHaveAttribute('data-detent', 'full');

    screen.getByRole('button', { name: 'Conteúdo' }).focus();
    await user.keyboard('{Escape}');
    expect(sheet()).toHaveAttribute('data-detent', 'peek');
    expect(handle()).toHaveFocus();
  });

  it('collapses with the close button and moves the focus to the handle', async () => {
    const user = userEvent.setup();
    render(<Example start="half" />);
    await user.click(screen.getByRole('button', { name: 'Recolher painel' }));
    expect(sheet()).toHaveAttribute('data-detent', 'peek');
    expect(handle()).toHaveFocus();
  });

  it('does not trap the focus: Tab leaves an open sheet', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Example start="half" />
        <button type="button">Depois</button>
      </>,
    );
    screen.getByRole('button', { name: 'Calcular' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois' })).toHaveFocus();
    expect(sheet()).toHaveAttribute('data-detent', 'half');
  });

  it('keeps the action usable at every detent', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn();
    render(<Example onVerify={onVerify} />);
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: 'Calcular' }));
      await user.click(handle());
    }
    expect(onVerify).toHaveBeenCalledTimes(3);
  });

  describe('dragging', () => {
    it('follows the finger and settles on the nearest detent after a slow drag', () => {
      render(<Example />);
      layout();
      const grip = sheet().querySelector('.sheet__grip')!;
      const down = new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientY: 900 });
      fireEvent(grip, down);
      fireEvent(
        grip,
        new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: 600 }),
      );
      expect(sheet().style.height).toBe('364px');
      expect(sheet()).toHaveAttribute('data-dragging', 'true');
      fireEvent(grip, new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientY: 600 }));
      expect(sheet().style.height).toBe('');
      expect(sheet()).not.toHaveAttribute('data-dragging');
      // 364 px is nearer to half (500) than to peek (64).
      expect(sheet()).toHaveAttribute('data-detent', 'half');
    });

    it('never grows past the frame or shrinks under the bar', () => {
      render(<Example start="half" />);
      layout();
      const grip = sheet().querySelector('.sheet__grip')!;
      fireEvent(
        grip,
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientY: 500 }),
      );
      fireEvent(
        grip,
        new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: -400 }),
      );
      expect(sheet().style.height).toBe('800px');
      fireEvent(
        grip,
        new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: 2000 }),
      );
      expect(sheet().style.height).toBe('64px');
      fireEvent(grip, new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
      expect(sheet()).toHaveAttribute('data-detent', 'peek');
    });

    it('goes one detent further on a flick, however short', () => {
      render(<Example />);
      layout();
      // 50 px in 50 ms from the handle: 1 px/ms upwards.
      drag(handle(), 950, 900, 10);
      expect(sheet()).toHaveAttribute('data-detent', 'half');
      drag(sheet().querySelector('.sheet__grip')!, 500, 450, 10);
      expect(sheet()).toHaveAttribute('data-detent', 'full');
      drag(sheet().querySelector('.sheet__grip')!, 200, 260, 10);
      expect(sheet()).toHaveAttribute('data-detent', 'half');
    });

    it('does not treat a drag that paused before the release as a flick', () => {
      render(<Example />);
      layout();
      drag(handle(), 950, 900, 10, 400);
      expect(sheet()).toHaveAttribute('data-detent', 'peek');
    });

    it('does not cycle on the click that ends a drag of the handle, but does on a tap', () => {
      render(<Example />);
      layout();
      drag(handle(), 950, 600, 100);
      expect(sheet()).toHaveAttribute('data-detent', 'half');
      fireEvent.click(handle(), { detail: 1 });
      expect(sheet()).toHaveAttribute('data-detent', 'half');

      // A press that barely moves is a tap.
      drag(handle(), 950, 948, 100);
      fireEvent.click(handle(), { detail: 1 });
      expect(sheet()).toHaveAttribute('data-detent', 'full');
    });
  });

  describe('side panel (phone held sideways)', () => {
    it('is always open, without handle, grip or close button', () => {
      render(<Example mode="side" />);
      expect(sheet()).not.toHaveAttribute('data-detent');
      expect(sheet().querySelector('.sheet__handle')).toBeNull();
      expect(sheet().querySelector('.sheet__grip')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Recolher painel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Conteúdo' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Calcular' })).toBeInTheDocument();
      expect(screen.queryByText('Aviso')).not.toBeInTheDocument();
    });
  });
});
