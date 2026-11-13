import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { designCost, evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Diameters, Scenario } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { StageHud } from './StageHud';

// toHaveTextContent turns the non-breaking space written by money() into a plain space.
const NBSP = ' ';

function stage(order: number): Scenario {
  const scenario = getScenario(`stage${order}`);
  if (!scenario) throw new Error(`stage ${order} not found`);
  return scenario;
}

/** Opens a stage in the store with a design, evaluated with the real solver unless told not to. */
function open(scenario: Scenario, diameters: Diameters, evaluate = true) {
  useAppStore.setState({
    scenario,
    diameters,
    evaluation: evaluate ? evaluateStage(scenario, diameters) : null,
    stale: false,
    verifiedAt: null,
  });
}

/** What `verify` leaves in the store after "Calcular / Verificar". */
function verify(scenario: Scenario, diameters: Diameters, at: number) {
  act(() => {
    useAppStore.setState({
      diameters,
      evaluation: evaluateStage(scenario, diameters),
      stale: false,
      solving: false,
      verifiedAt: at,
    });
  });
}

const item = (name: string) => screen.getByText(name).closest('.hud__item') as HTMLElement;
const brl = (text: string) => `R$${NBSP}${text}`;

describe('StageHud', () => {
  beforeEach(() => resetStore());

  it('renders nothing without an open stage', () => {
    const { container } = render(<StageHud />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('houses served', () => {
    it('shows a dash before the first result', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario), false);
      render(<StageHud />);
      expect(item('Casas atendidas')).toHaveTextContent('– / 33');
    });

    it('counts 6 of 33 with the initial design of stage 2', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(item('Casas atendidas')).toHaveTextContent('6 / 33');
    });

    it('counts 33 of 33 with the reference design of stage 2', () => {
      const scenario = stage(2);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      expect(item('Casas atendidas')).toHaveTextContent('33 / 33');
    });
  });

  describe('cost', () => {
    it('follows the diameters without a new evaluation', () => {
      const scenario = stage(2);
      const initial = initialDiameters(scenario);
      open(scenario, initial);
      render(<StageHud />);
      expect(item('Custo')).toHaveTextContent(
        brl(designCost(scenario, initial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })),
      );

      const evaluation = useAppStore.getState().evaluation;
      act(() => useAppStore.getState().setDiameter(scenario.pipes[0]!.id, 300));
      expect(useAppStore.getState().evaluation).toBe(evaluation);
      const changed = designCost(scenario, useAppStore.getState().diameters);
      expect(changed).not.toBe(designCost(scenario, initial));
      expect(item('Custo')).toHaveTextContent(
        brl(changed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })),
      );
    });

    it('hides the reference cost until the stage has been completed', () => {
      const scenario = stage(2);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      expect(item('Custo')).not.toHaveTextContent('Referência');

      act(() => useAppStore.setState({ progress: { stage2: makeProgress('stage2') } }));
      expect(item('Custo')).toHaveTextContent(`Referência ${brl('64.160,00')} (igual)`);
    });

    it('compares a more expensive design with the reference once completed', () => {
      const scenario = stage(2);
      const diameters = { ...scenario.reference.diameters };
      for (const pipe of scenario.pipes) if (!pipe.fixed) diameters[pipe.id] = 300;
      useAppStore.setState({ progress: { stage2: makeProgress('stage2') } });
      open(scenario, diameters);
      render(<StageHud />);
      expect(item('Custo')).toHaveTextContent(/Referência R\$\s64\.160,00 \(\d+,\d % acima\)/);
    });

    it('draws the cost against the budget in stage 4', () => {
      const scenario = stage(4);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      const cost = item('Custo');
      expect(cost).toHaveTextContent(brl('137.400,00'));
      expect(cost).toHaveTextContent(`Orçamento ${brl('159.000,00')}`);
      expect(cost).not.toHaveTextContent('Referência');
      expect(cost).not.toHaveTextContent('Acima do orçamento');
      const bar = within(cost).getByRole('img', { name: 'Custo em relação ao orçamento' });
      expect(bar.querySelector('.hud__bar-budget')).toHaveStyle({ left: '80%' });
      expect(bar.querySelector('.hud__bar-fill')).not.toHaveClass('hud__bar-fill--over');
      expect(bar.querySelector('.hud__bar-reference')).toBeNull();
    });

    it('marks the reference cost on the budget bar once stage 4 is completed', () => {
      const scenario = stage(4);
      useAppStore.setState({ progress: { stage4: makeProgress('stage4') } });
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      const cost = item('Custo');
      expect(cost).toHaveTextContent(`Referência ${brl('137.400,00')}`);
      expect(cost.querySelector('.hud__bar-reference')).toBeInTheDocument();
    });

    it('shows the over-budget state with icon and text', () => {
      const scenario = stage(4);
      const diameters = { ...scenario.reference.diameters };
      for (const pipe of scenario.pipes) if (!pipe.fixed) diameters[pipe.id] = 300;
      const cost = designCost(scenario, diameters);
      expect(cost).toBeGreaterThan(scenario.budget!);
      open(scenario, diameters);
      render(<StageHud />);
      const node = item('Custo');
      expect(node).toHaveClass('hud__item--over');
      expect(node).toHaveTextContent(
        `Acima do orçamento em ${brl(
          (cost - scenario.budget!).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        )}`,
      );
      expect(node.querySelector('.hud__over svg')).toBeInTheDocument();
      expect(node.querySelector('.hud__bar-fill')).toHaveClass('hud__bar-fill--over');
    });
  });

  describe('stars', () => {
    it('asks for a calculation before the first result', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario), false);
      render(<StageHud />);
      expect(item('Estrelas')).toHaveTextContent('Calcule para ver');
      expect(screen.getByRole('img', { name: '0 de 3 estrelas' })).toBeInTheDocument();
    });

    it('shows no stars for a failing design', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(screen.getByRole('img', { name: '0 de 3 estrelas' })).toBeInTheDocument();
      expect(item('Estrelas')).toHaveTextContent('Projeto ainda reprovado');
    });

    it('shows three stars for the reference design', () => {
      const scenario = stage(2);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      expect(screen.getByRole('img', { name: '3 de 3 estrelas' })).toBeInTheDocument();
      expect(item('Estrelas')).toHaveTextContent('Nota máxima');
    });

    it('tells the cost of the next star when the design passes with fewer than three', () => {
      const scenario = stage(2);
      const diameters = { ...scenario.reference.diameters };
      for (const pipe of scenario.pipes) if (!pipe.fixed) diameters[pipe.id] = 300;
      open(scenario, diameters);
      const evaluation = useAppStore.getState().evaluation!;
      expect(evaluation.passed).toBe(true);
      expect(evaluation.stars).toBe(1);
      render(<StageHud />);
      expect(screen.getByRole('img', { name: '1 de 3 estrelas' })).toBeInTheDocument();
      // 64 160 × 1,25 = 80 200
      expect(item('Estrelas')).toHaveTextContent(`Próxima estrela com custo ≤ ${brl('80.200,00')}`);
    });
  });

  it('dims the last result while it is stale and keeps the cost current', () => {
    const scenario = stage(2);
    open(scenario, initialDiameters(scenario));
    render(<StageHud />);
    expect(item('Casas atendidas')).not.toHaveAttribute('data-stale');

    act(() => useAppStore.getState().setDiameter(scenario.pipes[0]!.id, 300));
    expect(item('Casas atendidas')).toHaveAttribute('data-stale', 'true');
    expect(item('Casas atendidas')).toHaveTextContent('6 / 33');
    expect(item('Casas atendidas')).toHaveTextContent('Resultado anterior à última alteração');
    expect(item('Estrelas')).toHaveAttribute('data-stale', 'true');
    expect(item('Custo')).not.toHaveAttribute('data-stale');
  });

  describe('objective', () => {
    it('shows the first objective and opens the full list', async () => {
      const user = userEvent.setup();
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(item('Objetivo')).toHaveTextContent('Pressão dinâmica mínima de 10 mca');
      expect(screen.queryByRole('list')).not.toBeInTheDocument();

      const more = screen.getByRole('button', { name: 'Ver os 3 objetivos' });
      expect(more).toHaveAttribute('aria-expanded', 'false');
      await user.click(more);
      expect(more).toHaveAttribute('aria-expanded', 'true');
      const items = within(screen.getByRole('list')).getAllByRole('listitem');
      expect(items.map((li) => li.textContent)).toEqual([
        'Pressão dinâmica mínima de 10 mca',
        'Pressão estática máxima de 40 mca',
        'Velocidade máxima de 3,5 m/s',
      ]);

      await user.keyboard('{Escape}');
      expect(more).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('feedback after Calcular / Verificar', () => {
    it('stays silent for the evaluation made when the stage opens', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(screen.getByTestId('hud-live')).toBeEmptyDOMElement();
      expect(screen.getByTestId('hud-live')).toHaveAttribute('aria-live', 'polite');
    });

    it('announces a failed verification with the houses served', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      verify(scenario, initialDiameters(scenario), 1000);
      expect(screen.getByTestId('hud-live')).toHaveTextContent(/^6 de 33 casas atendidas$/);
    });

    it('announces a passed verification with houses and stars', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      verify(scenario, scenario.reference.diameters, 1000);
      expect(screen.getByTestId('hud-live')).toHaveTextContent(
        /^Etapa aprovada: 33 de 33 casas atendidas, 3 estrelas$/,
      );
      // jsdom has no matchMedia, which is treated as reduced motion: final state at once.
      expect(item('Casas atendidas')).toHaveTextContent('33 / 33');
      expect(document.querySelector('.hud__stars--reveal')).toBeNull();
    });

    it('says why a design that serves every house still fails', () => {
      const scenario = stage(4);
      const diameters = { ...scenario.reference.diameters };
      for (const pipe of scenario.pipes) if (!pipe.fixed) diameters[pipe.id] = 300;
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      verify(scenario, diameters, 1000);
      const total = within(item('Casas atendidas'))
        .getByText(/\/ \d+/)
        .textContent!.split('/ ')[1];
      expect(screen.getByTestId('hud-live')).toHaveTextContent(
        `${total} de ${total} casas atendidas, custo acima do orçamento`,
      );
    });

    it('clears the announcement while solving and when the result goes stale', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      verify(scenario, initialDiameters(scenario), 1000);
      act(() => useAppStore.setState({ solving: true }));
      expect(screen.getByTestId('hud-live')).toBeEmptyDOMElement();
      verify(scenario, initialDiameters(scenario), 2000);
      expect(screen.getByTestId('hud-live')).toHaveTextContent('6 de 33 casas atendidas');
      act(() => useAppStore.getState().setDiameter(scenario.pipes[0]!.id, 300));
      expect(screen.getByTestId('hud-live')).toBeEmptyDOMElement();
    });

    describe('with motion allowed', () => {
      beforeEach(() => {
        vi.useFakeTimers({
          toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
        });
        vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
      });
      afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      });

      it('counts the houses up and reveals the stars on a pass', () => {
        const scenario = stage(2);
        open(scenario, initialDiameters(scenario));
        render(<StageHud />);
        verify(scenario, scenario.reference.diameters, 1000);
        expect(item('Casas atendidas')).toHaveTextContent('0 / 33');
        expect(document.querySelector('.hud__stars--reveal')).toBeInTheDocument();

        act(() => void vi.advanceTimersByTime(350));
        const midway = Number(item('Casas atendidas').textContent!.match(/(\d+) \/ 33/)![1]);
        expect(midway).toBeGreaterThan(0);
        expect(midway).toBeLessThan(33);

        act(() => void vi.advanceTimersByTime(1000));
        expect(item('Casas atendidas')).toHaveTextContent('33 / 33');
      });

      it('does not animate a failed verification', () => {
        const scenario = stage(2);
        open(scenario, initialDiameters(scenario));
        render(<StageHud />);
        verify(scenario, initialDiameters(scenario), 1000);
        expect(item('Casas atendidas')).toHaveTextContent('6 / 33');
        expect(document.querySelector('.hud__stars--reveal')).toBeNull();
      });
    });
  });

  it('follows the language', () => {
    const scenario = stage(4);
    useAppStore.setState({ lang: 'en' });
    open(scenario, scenario.reference.diameters);
    render(<StageHud />);
    expect(screen.getByRole('region', { name: 'Design status' })).toBeInTheDocument();
    expect(item('Houses served')).toBeInTheDocument();
    expect(item('Cost')).toHaveTextContent(`R$${NBSP}137,400.00`);
    expect(item('Cost')).toHaveTextContent(`Budget R$${NBSP}159,000.00`);
    expect(item('Stars')).toHaveTextContent('Top rating');
    expect(item('Objective')).toHaveTextContent('Minimum dynamic pressure of 10 mca');
    expect(screen.getByRole('button', { name: 'See all 3 objectives' })).toBeInTheDocument();

    verify(scenario, scenario.reference.diameters, 1000);
    expect(screen.getByTestId('hud-live')).toHaveTextContent(
      /^Stage passed: \d+ of \d+ houses served, 3 stars$/,
    );
  });
});

describe('StageHud compact (phone)', () => {
  beforeEach(() => resetStore());

  const summary = () => screen.getByRole('button', { name: /Casas atendidas/ });

  it('shows houses, cost and stars in one button', () => {
    const scenario = stage(2);
    open(scenario, scenario.reference.diameters);
    render(<StageHud compact />);
    const cost = brl(
      designCost(scenario, scenario.reference.diameters).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
      }),
    );
    expect(summary()).toHaveTextContent(/Casas atendidas:\s*\d+ \/ \d+/);
    expect(summary()).toHaveTextContent(`Custo:${cost}`);
    expect(within(summary()).getByRole('img', { name: /de 3 estrelas/ })).toBeInTheDocument();
    expect(summary()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the full figures and every objective, and closes on Escape or a press outside', async () => {
    const user = userEvent.setup();
    const scenario = stage(2);
    open(scenario, scenario.reference.diameters);
    render(
      <>
        <StageHud compact />
        <button type="button">Fora</button>
      </>,
    );
    const details = document.getElementById(summary().getAttribute('aria-controls') ?? '');
    expect(details).not.toBeVisible();

    await user.click(summary());
    expect(summary()).toHaveAttribute('aria-expanded', 'true');
    expect(details).toBeVisible();
    expect(within(details!).getByText('Custo')).toBeInTheDocument();
    expect(within(details!).getAllByRole('listitem')).toHaveLength(scenario.objectives.length);

    await user.keyboard('{Escape}');
    expect(details).not.toBeVisible();
    await user.click(summary());
    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(details).not.toBeVisible();
  });

  it('marks a cost over the budget with words, not only colour', () => {
    const scenario = stage(4);
    const expensive = Object.fromEntries(scenario.pipes.map((pipe) => [pipe.id, 300]));
    open(scenario, expensive);
    render(<StageHud compact />);
    expect(summary()).toHaveTextContent('Custo, acima do orçamento:');
    expect(summary().querySelector('.hud__chip--over svg')).not.toBeNull();
  });

  it('says that a result is from before the last change', () => {
    const scenario = stage(2);
    open(scenario, scenario.reference.diameters);
    act(() => useAppStore.setState({ stale: true }));
    render(<StageHud compact />);
    expect(summary()).toHaveTextContent('Resultado anterior à última alteração');
  });

  it('announces the result of a verification like the wide form', () => {
    const scenario = stage(2);
    open(scenario, initialDiameters(scenario));
    render(<StageHud compact />);
    verify(scenario, scenario.reference.diameters, 10);
    expect(screen.getByTestId('hud-live')).toHaveTextContent(/Etapa aprovada/);
  });
});
