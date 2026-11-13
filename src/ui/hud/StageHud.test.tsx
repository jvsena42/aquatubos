import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

/** A HUD item by its name, which is hidden text ("Custo:") next to the icon and the number. */
const item = (name: string) => screen.getByText(`${name}:`).closest('.hud__item') as HTMLElement;
const brl = (text: string) => `R$${NBSP}${text}`;

/** Opens the help of a topic and returns its popover. */
function help(topic: string, prefix = 'Ajuda'): HTMLElement {
  const name = `${prefix}: ${topic}`;
  const button = screen.getByRole('button', { name });
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button);
  return screen.getByRole('note', { name });
}

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

    it('explains the number and lists the objectives in its help', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(screen.queryByText(/Pressão dinâmica mínima de 10 mca/)).not.toBeInTheDocument();
      const note = help('Casas atendidas');
      expect(note).toHaveTextContent('Casas em nós sem falha de pressão no último cálculo.');
      expect(note).toHaveTextContent('Objetivos da etapa');
      const items = within(note).getAllByRole('listitem');
      expect(items.map((li) => li.textContent)).toEqual([
        'Pressão dinâmica mínima de 10 mca',
        'Pressão estática máxima de 40 mca',
        'Velocidade máxima de 3,5 m/s',
      ]);
    });
  });

  it('shows only icons and numbers: no captions, hints or objective in the default view', () => {
    const scenario = stage(4);
    useAppStore.setState({ progress: { stage4: makeProgress('stage4') } });
    open(scenario, scenario.reference.diameters);
    render(<StageHud />);
    const hud = screen.getByRole('region', { name: 'Situação do projeto' });
    expect(hud).not.toHaveTextContent(/Referência|Orçamento|Nota máxima|reprovado|Objetivo/);
    expect(hud.querySelectorAll('.hud__item > svg.icon')).toHaveLength(2);
    // The names stay for assistive tech (and as tooltips), each with its own help button.
    expect(item('Casas atendidas')).toHaveAttribute('title', 'Casas atendidas');
    for (const topic of ['Casas atendidas', 'Custo', 'Estrelas']) {
      expect(screen.getByRole('button', { name: `Ajuda: ${topic}` })).toBeInTheDocument();
    }
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
      expect(help('Custo')).toHaveTextContent('Soma, em todos os trechos, do preço por metro');
      expect(help('Custo')).not.toHaveTextContent('Referência');

      act(() => useAppStore.setState({ progress: { stage2: makeProgress('stage2') } }));
      expect(help('Custo')).toHaveTextContent(`Referência ${brl('64.160,00')} (igual).`);
    });

    it('compares a more expensive design with the reference once completed', () => {
      const scenario = stage(2);
      const diameters = { ...scenario.reference.diameters };
      for (const pipe of scenario.pipes) if (!pipe.fixed) diameters[pipe.id] = 300;
      useAppStore.setState({ progress: { stage2: makeProgress('stage2') } });
      open(scenario, diameters);
      render(<StageHud />);
      expect(help('Custo')).toHaveTextContent(/Referência R\$\s64\.160,00 \(\d+,\d % acima\)/);
    });

    it('draws the cost against the budget in stage 4', () => {
      const scenario = stage(4);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      const cost = item('Custo');
      expect(cost).toHaveTextContent(brl('137.400,00'));
      expect(cost).not.toHaveTextContent('Orçamento');
      // 159 000 − 137 400 = 21 600
      expect(help('Custo')).toHaveTextContent(
        `Orçamento ${brl('159.000,00')}: sobram ${brl('21.600,00')}.`,
      );
      expect(help('Custo')).not.toHaveTextContent('Referência');
      expect(help('Custo')).not.toHaveTextContent('Acima do orçamento');
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
      expect(help('Custo')).toHaveTextContent(`Referência ${brl('137.400,00')}`);
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
      const node = item('Custo, acima do orçamento');
      expect(node).toHaveClass('hud__item--over');
      // Not by colour alone: an error icon and the name "Custo, acima do orçamento".
      expect(node.querySelector(':scope > svg.icon')).toBeInTheDocument();
      expect(node).toHaveAttribute('title', 'Custo, acima do orçamento');
      expect(help('Custo')).toHaveTextContent(
        `Acima do orçamento em ${brl(
          (cost - scenario.budget!).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        )}`,
      );
      expect(node.querySelector('.hud__bar-fill')).toHaveClass('hud__bar-fill--over');
    });
  });

  describe('stars', () => {
    it('asks for a calculation before the first result', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario), false);
      render(<StageHud />);
      expect(item('Estrelas')).not.toHaveTextContent('Calcule');
      // 1,25 and 1,05 times the reference cost, from STAR_THRESHOLDS.
      expect(help('Estrelas')).toHaveTextContent(
        '1 estrela: projeto aprovado. 2 estrelas: custo até 25 % acima da solução de referência. 3 estrelas: até 5 %.',
      );
      expect(help('Estrelas')).toHaveTextContent('Calcule para ver as estrelas.');
      expect(screen.getByRole('img', { name: '0 de 3 estrelas' })).toBeInTheDocument();
    });

    it('shows no stars for a failing design', () => {
      const scenario = stage(2);
      open(scenario, initialDiameters(scenario));
      render(<StageHud />);
      expect(screen.getByRole('img', { name: '0 de 3 estrelas' })).toBeInTheDocument();
      expect(item('Estrelas')).not.toHaveTextContent('reprovado');
      expect(help('Estrelas')).toHaveTextContent('Projeto ainda reprovado.');
    });

    it('shows three stars for the reference design', () => {
      const scenario = stage(2);
      open(scenario, scenario.reference.diameters);
      render(<StageHud />);
      expect(screen.getByRole('img', { name: '3 de 3 estrelas' })).toBeInTheDocument();
      expect(item('Estrelas')).not.toHaveTextContent('Nota máxima');
      expect(help('Estrelas')).toHaveTextContent('Nota máxima.');
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
      expect(help('Estrelas')).toHaveTextContent(
        `Próxima estrela com custo ≤ ${brl('80.200,00')}.`,
      );
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
    expect(help('Cost', 'Help')).toHaveTextContent(
      `Budget R$${NBSP}159,000.00: R$${NBSP}21,600.00 to spare.`,
    );
    expect(help('Stars', 'Help')).toHaveTextContent('Top rating.');
    expect(help('Houses served', 'Help')).toHaveTextContent('Minimum dynamic pressure of 10 mca');

    verify(scenario, scenario.reference.diameters, 1000);
    expect(screen.getByTestId('hud-live')).toHaveTextContent(
      /^Stage passed: \d+ of \d+ houses served, 3 stars$/,
    );
  });
});

describe('StageHud compact (phone)', () => {
  beforeEach(() => resetStore());

  const hud = () => screen.getByRole('region', { name: 'Situação do projeto' });

  it('shows houses, cost without cents and stars in one line with a single help button', () => {
    const scenario = stage(2);
    open(scenario, scenario.reference.diameters);
    render(<StageHud compact />);
    expect(hud()).toHaveClass('hud--compact');
    expect(hud()).toHaveTextContent(/Casas atendidas:\s*33\/33/);
    expect(hud()).toHaveTextContent(`Custo:${brl('64.160')}`);
    expect(hud()).not.toHaveTextContent('64.160,00');
    expect(within(hud()).getByRole('img', { name: '3 de 3 estrelas' })).toBeInTheDocument();
    expect(within(hud()).getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ajuda: Situação do projeto' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('explains the three numbers and lists every objective in the help', () => {
    const scenario = stage(2);
    useAppStore.setState({ progress: { stage2: makeProgress('stage2') } });
    open(scenario, scenario.reference.diameters);
    render(<StageHud compact />);
    const note = help('Situação do projeto');
    expect(note).toHaveTextContent('Casas em nós sem falha de pressão');
    expect(note).toHaveTextContent(`Custo atual: ${brl('64.160,00')}.`);
    expect(note).toHaveTextContent(`Referência ${brl('64.160,00')} (igual).`);
    expect(note).toHaveTextContent('Nota máxima.');
    expect(within(note).getAllByRole('listitem')).toHaveLength(scenario.objectives.length);
  });

  it('marks a cost over the budget with an icon and words, not only colour', () => {
    const scenario = stage(4);
    const expensive = Object.fromEntries(scenario.pipes.map((pipe) => [pipe.id, 300]));
    open(scenario, expensive);
    render(<StageHud compact />);
    expect(hud()).toHaveTextContent('Custo, acima do orçamento:');
    expect(hud().querySelector('.hud__item--over > svg.icon')).not.toBeNull();
    expect(within(hud()).getByRole('img', { name: 'Custo em relação ao orçamento' })).toBeVisible();
  });

  it('says that a result is from before the last change', () => {
    const scenario = stage(2);
    open(scenario, scenario.reference.diameters);
    act(() => useAppStore.setState({ stale: true }));
    render(<StageHud compact />);
    expect(hud()).toHaveTextContent('Resultado anterior à última alteração');
  });

  it('announces the result of a verification like the wide form', () => {
    const scenario = stage(2);
    open(scenario, initialDiameters(scenario));
    render(<StageHud compact />);
    verify(scenario, scenario.reference.diameters, 10);
    expect(screen.getByTestId('hud-live')).toHaveTextContent(/Etapa aprovada/);
  });
});
