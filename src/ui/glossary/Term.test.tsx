import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { GLOSSARY, TERM_IDS } from './glossary';
import { GlossaryDialog } from './GlossaryDialog';
import { Term } from './Term';

describe('Term', () => {
  beforeEach(() => resetStore());

  it('describes the text with the definition and keeps the tooltip hidden at first', () => {
    render(<Term id="hgl">cota piezométrica</Term>);
    const trigger = screen.getByRole('button', { name: 'cota piezométrica' });
    expect(trigger).toHaveAccessibleDescription(
      `${GLOSSARY.hgl.term.pt}${GLOSSARY.hgl.definition.pt}`,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus, closes with Escape and on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Term id="headLoss">perda de carga</Term>
        <button type="button">outro</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'perda de carga' })).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent(GLOSSARY.headLoss.definition.pt);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    await user.tab({ shift: true });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on hover and closes when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<Term id="mca">mca</Term>);
    await user.hover(screen.getByRole('button', { name: 'mca' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.unhover(screen.getByRole('button', { name: 'mca' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('ignores hover where the device cannot hover', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query !== '(hover: hover)' }));
    const user = userEvent.setup();
    render(<Term id="mca">mca</Term>);
    await user.hover(screen.getByRole('button', { name: 'mca' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('keeps the tooltip open on a mouse click after hover', async () => {
    const user = userEvent.setup();
    render(<Term id="mca">mca</Term>);
    const trigger = screen.getByRole('button', { name: 'mca' });
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens on a tap and closes on the next tap', async () => {
    const user = userEvent.setup();
    render(<Term id="headLoss">perda de carga</Term>);
    const trigger = screen.getByRole('button', { name: 'perda de carga' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.getByRole('tooltip')).toHaveTextContent(GLOSSARY.headLoss.definition.pt);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The finger lifting, and the mouse events browsers send after a tap, are not a hover out.
    fireEvent.pointerOut(trigger, { pointerType: 'touch' });
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' });
    fireEvent.mouseOut(trigger);
    fireEvent.mouseLeave(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // The term keeps the focus after the second tap; a third tap opens it again.
    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('closes on a tap outside, also where the tap does not move the focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Term id="flow">vazão</Term>
        <p>texto ao lado</p>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'vazão' });
    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.pointer({ keys: '[TouchA]', target: screen.getByText('texto ao lado') });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // iOS does not focus a button on tap, so there is no blur: the press alone must close it.
    fireEvent.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('texto ao lado'), { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays open while the tooltip itself is pressed', async () => {
    const user = userEvent.setup();
    render(<Term id="flow">vazão</Term>);
    const trigger = screen.getByRole('button', { name: 'vazão' });
    await user.pointer({ keys: '[TouchA]', target: trigger });
    const tooltip = screen.getByRole('tooltip');
    await user.pointer({ keys: '[TouchA]', target: tooltip });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes with Escape wherever the focus is and keeps the key from an enclosing dialog', () => {
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <Term id="flow">vazão</Term>
      </div>,
    );
    // Opened without focus, as a tap does on iOS.
    fireEvent.click(screen.getByRole('button', { name: 'vazão' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(fireEvent.keyDown(document.body, { key: 'Escape' })).toBe(false);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'vazão' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'vazão' }), { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(onKeyDown).not.toHaveBeenCalled();

    // With the tooltip closed, Escape is left alone.
    fireEvent.keyDown(screen.getByRole('button', { name: 'vazão' }), { key: 'Escape' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('toggles with Enter after Escape closed it', async () => {
    const user = userEvent.setup();
    render(<Term id="flow">vazão</Term>);
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes when the content scrolls, but not when the tooltip itself scrolls', () => {
    render(<Term id="flow">vazão</Term>);
    fireEvent.click(screen.getByRole('button', { name: 'vazão' }));
    fireEvent.scroll(screen.getByRole('tooltip'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.scroll(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the tooltip outside containers that would clip it', () => {
    const { container } = render(
      <div style={{ overflow: 'hidden' }}>
        <Term id="flow">vazão</Term>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'vazão' }));
    const tooltip = screen.getByRole('tooltip');
    expect(container).not.toContainElement(tooltip);
    expect(tooltip.parentElement).toBe(document.body);
  });

  it('renders the tooltip inside the dialog of a term that is in one', () => {
    render(
      <dialog open>
        <Term id="flow">vazão</Term>
      </dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'vazão' }));
    expect(screen.getByRole('tooltip').parentElement).toBe(document.querySelector('dialog'));
  });

  describe('placement', () => {
    const rect = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
      }) as DOMRect;

    beforeEach(() => {
      vi.stubGlobal('innerWidth', 360);
      vi.stubGlobal('innerHeight', 640);
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(360);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    });
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('keeps the tooltip of a term at the right edge of a 360 px screen inside it', () => {
      render(<Term id="flow">vazão</Term>);
      const trigger = screen.getByRole('button', { name: 'vazão' });
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(300, 200, 52, 20));
      fireEvent.click(trigger);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveStyle({ left: '32px', top: '224px', width: '320px' });
      expect(tooltip.style.maxHeight).toBe('');
    });

    it('opens above a term at the bottom of the screen', () => {
      render(<Term id="flow">vazão</Term>);
      const trigger = screen.getByRole('button', { name: 'vazão' });
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(20, 600, 52, 20));
      fireEvent.click(trigger);
      // 600 − 4 − 120.
      expect(screen.getByRole('tooltip')).toHaveStyle({ left: '20px', top: '476px' });
    });
  });

  it('uses the term name when no text is given and follows the language', () => {
    useAppStore.setState({ lang: 'en' });
    render(<Term id="hardyCross" />);
    expect(screen.getByRole('button', { name: 'Hardy Cross method' })).toHaveAccessibleDescription(
      new RegExp('Iterative method for looped networks'),
    );
  });
});

describe('glossary', () => {
  beforeEach(() => resetStore());

  it('has a name and a definition in both languages for every term', () => {
    expect(TERM_IDS.length).toBeGreaterThanOrEqual(23);
    for (const id of TERM_IDS) {
      for (const lang of ['pt', 'en'] as const) {
        expect(GLOSSARY[id].term[lang].length).toBeGreaterThan(1);
        expect(GLOSSARY[id].definition[lang].length).toBeGreaterThan(20);
      }
    }
  });

  it('lists every term in the dialog', () => {
    render(<GlossaryDialog open onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Glossário' })).toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(TERM_IDS.length);
    expect(screen.getByText(GLOSSARY.nbr12218.definition.pt)).toBeInTheDocument();
  });
});
