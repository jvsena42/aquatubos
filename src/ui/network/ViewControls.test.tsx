import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { PHONE_QUERY } from '../shell/breakpoints';
import { LegendIcons } from './Legend';
import { mockMatchMedia } from './mockMatchMedia';
import { ControlStrip, MapFoot } from './ViewControls';

vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const scenario = getScenario('stage3')!;

function openStage(solved = true) {
  const diameters = initialDiameters(scenario);
  useAppStore.setState({
    scenario,
    diameters,
    formula: scenario.formula,
    evaluation: solved ? evaluateStage(scenario, diameters, scenario.formula) : null,
  });
}

const legend = <LegendIcons checks={scenario.checks} evaluated />;

describe('ControlStrip', () => {
  beforeEach(() => resetStore());

  it('is one group of icon buttons, each marked as an overlay control', async () => {
    const user = userEvent.setup();
    const onZoom = vi.fn();
    const onFit = vi.fn();
    render(
      <ControlStrip orientation="column" onZoom={onZoom} onFit={onFit}>
        <span data-overlay-control="legend">?</span>
      </ControlStrip>,
    );
    const strip = screen.getByRole('group', { name: 'Controles do mapa' });
    expect(strip).toHaveAttribute('data-orientation', 'column');
    expect(strip.querySelectorAll('[data-overlay-control]')).toHaveLength(4);
    for (const button of within(strip).getAllByRole('button')) {
      expect(button).toHaveAttribute('data-overlay-control');
      expect(button).toHaveAttribute('title');
      expect(button).toHaveTextContent('');
    }
    await user.click(screen.getByRole('button', { name: 'Aproximar' }));
    expect(onZoom).toHaveBeenLastCalledWith(1.4);
    await user.click(screen.getByRole('button', { name: 'Afastar' }));
    expect(onZoom).toHaveBeenLastCalledWith(1 / 1.4);
    await user.click(screen.getByRole('button', { name: 'Enquadrar a rede' }));
    expect(onFit).toHaveBeenCalledOnce();
  });
});

describe('MapFoot', () => {
  beforeEach(() => resetStore());

  describe('on a tablet or desktop', () => {
    it('shows the legend symbols and its help, and never a diameter picker', () => {
      openStage();
      render(<MapFoot phone={false} legend={legend} help={<button type="button">ajuda</button>} />);
      expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ajuda' })).toBeInTheDocument();
      expect(screen.queryByText('Selecione um trecho')).not.toBeInTheDocument();

      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T2' }));
      expect(screen.queryByRole('group', { name: /^Diâmetro nominal/ })).not.toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
    });

    it('says in one or two words that there is no result or that it is outdated', () => {
      openStage(false);
      render(<MapFoot phone={false} legend={legend} />);
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Sem cálculo');
      expect(status).toHaveAttribute('title', 'Calcule para ver pressões, vazões e velocidades.');
      expect(
        within(status).getByText('Calcule para ver pressões, vazões e velocidades.'),
      ).toHaveClass('visually-hidden');

      openStage();
      act(() => useAppStore.setState({ stale: true }));
      expect(screen.getByRole('status')).toHaveTextContent('Desatualizado');
      act(() => useAppStore.setState({ stale: false }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('on a phone', () => {
    let restore = () => {};
    beforeEach(() => {
      restore = mockMatchMedia([PHONE_QUERY]);
    });
    afterEach(() => restore());

    it('shows a three-word hint and the legend symbols while no pipe is selected', () => {
      openStage();
      render(<MapFoot phone legend={legend} />);
      expect(screen.getByText('Selecione um trecho')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
      expect(document.querySelector('#dn-bar')).toBeNull();
      // A node has no diameter: the row stays as it is.
      act(() => useAppStore.getState().select({ type: 'node', id: 'A' }));
      expect(screen.getByText('Selecione um trecho')).toBeInTheDocument();
    });

    it('gives the row to the seven diameter keys of the selected pipe', async () => {
      const user = userEvent.setup();
      openStage();
      useAppStore.getState().select({ type: 'pipe', id: 'T2' });
      render(<MapFoot phone legend={legend} />);
      const row = document.querySelector('.netview__foot')!;
      expect(row).toHaveClass('netview__foot--pipe');
      // Title: the id over the length, the full words for screen readers only.
      expect(row.querySelector('.netview__foot-title')).toHaveTextContent(/T2\d+ m$/);
      expect(screen.getByText(/^Trecho T2, \d+ m$/)).toHaveClass('visually-hidden');
      expect(screen.queryByText(/preço em/)).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Legenda' })).not.toBeInTheDocument();

      const group = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
      expect(group).toHaveAttribute('id', 'dn-bar');
      expect(group.closest('.dn-picker')).toHaveClass('dn-picker--bar');
      const keys = within(group).getAllByRole('button');
      expect(keys.map((key) => key.querySelector('.dn-picker__dn')!.textContent)).toEqual([
        '50',
        '75',
        '100',
        '150',
        '200',
        '250',
        '300',
      ]);
      // Each key: the DN over its price; the whole price is in the accessible name.
      expect(keys[2]).toHaveTextContent(/^100R\$\s65$/);
      expect(keys[2]).toHaveAccessibleName(/^DN 100, R\$\s65,00 por metro$/);
      expect(document.querySelector('#dn-bar [aria-pressed="true"]')).toBe(keys[0]);

      await user.click(keys[3]!);
      expect(useAppStore.getState().diameters.T2).toBe(150);
      expect(document.querySelector('#dn-bar [aria-pressed="true"]')).toBe(keys[3]);
    });

    it('brings the pressed key to the middle of the scrolling row', () => {
      const offsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
      const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      const clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
      const scrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
      // Seven keys of 44 px in a row 200 px wide.
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
        configurable: true,
        get(this: HTMLElement) {
          return [...(this.parentElement?.children ?? [])].indexOf(this) * 44;
        },
      });
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get: () => 44,
      });
      Object.defineProperty(Element.prototype, 'clientWidth', {
        configurable: true,
        get: () => 200,
      });
      Object.defineProperty(Element.prototype, 'scrollWidth', {
        configurable: true,
        get: () => 308,
      });
      try {
        openStage();
        useAppStore.setState({ diameters: { ...initialDiameters(scenario), T2: 150 } });
        useAppStore.getState().select({ type: 'pipe', id: 'T2' });
        render(<MapFoot phone legend={legend} />);
        const group = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
        // DN 150 is the fourth key: 3 × 44 − (200 − 44) / 2 = 54.
        expect(group.scrollLeft).toBe(54);
        // Keys are hidden on both sides: both edge fades are on.
        const picker = group.closest('.dn-picker')!;
        expect(picker).toHaveAttribute('data-fade-start', 'true');
        expect(picker).toHaveAttribute('data-fade-end', 'true');

        act(() => useAppStore.getState().setDiameter('T2', 200));
        expect(group.scrollLeft).toBe(98);
      } finally {
        Object.defineProperty(HTMLElement.prototype, 'offsetLeft', offsetLeft!);
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth!);
        Object.defineProperty(Element.prototype, 'clientWidth', clientWidth!);
        Object.defineProperty(Element.prototype, 'scrollWidth', scrollWidth!);
      }
    });
  });
});
