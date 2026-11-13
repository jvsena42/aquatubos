import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { ROAD_DY, stripLayout, wideLayout } from './mapLayout';
import { StageSelect } from './StageSelect';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const details = () => within(screen.getByTestId('stage-details'));
/** The stage buttons, without the back button of the screen header. */
const stageButtons = () => within(screen.getByRole('list')).getAllByRole('button');

describe('StageSelect', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('keeps the heading and the intro', () => {
    render(<StageSelect />);
    expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toBeInTheDocument();
    expect(screen.getByText(/Concluir uma etapa libera a seguinte/)).toBeInTheDocument();
  });

  it('has one button per stage, in play order, with number and title', () => {
    render(<StageSelect />);
    const buttons = stageButtons();
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Etapa 1: Título 1',
      'Etapa 2: Título 2. Bloqueada: conclua a etapa 1 para liberar.',
      'Etapa 3: Título 3. Bloqueada: conclua a etapa 2 para liberar.',
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('1Título 1');
    expect(buttons[2]).toHaveTextContent('3Título 3');
  });

  it('unlocks only the first stage when there is no progress', () => {
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /^Etapa 1: Título 1/ });
    expect(first).toBeEnabled();
    expect(first).toHaveTextContent('Não iniciada');
    const second = screen.getByRole('button', { name: /^Etapa 2: .*Bloqueada/ });
    expect(second).toBeDisabled();
    expect(second).toHaveTextContent('Bloqueada');
    expect(second.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('describes an unlocked stage with its status and summary', () => {
    render(<StageSelect />);
    expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveAccessibleDescription(
      'Não iniciada. Resumo 1. Próxima etapa a jogar',
    );
  });

  describe('screen header', () => {
    it('goes back to the title screen', async () => {
      useAppStore.setState({ screen: 'map' });
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.click(screen.getByRole('button', { name: 'Início' }));
      expect(useAppStore.getState().screen).toBe('home');
    });

    it('shows the total of stars out of three per stage', () => {
      render(<StageSelect />);
      expect(screen.getByTestId('stages-total')).toHaveTextContent('Estrelas: 0 / 9');

      act(() =>
        useAppStore.setState({
          progress: {
            'stage-1': makeProgress('stage-1', { stars: 3 }),
            'stage-2': makeProgress('stage-2', { stars: 1 }),
          },
        }),
      );
      expect(screen.getByTestId('stages-total')).toHaveTextContent('Estrelas: 4 / 9');
    });

    it('has a heading that can receive focus', () => {
      render(<StageSelect />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('next stage marker', () => {
    it('marks the first stage when there is no progress', () => {
      const { container } = render(<StageSelect />);
      const first = screen.getByRole('button', { name: /^Etapa 1: / });
      expect(first).toHaveClass('stage-pin--next');
      expect(within(first).getByText('Próxima')).toBeInTheDocument();
      expect(screen.getAllByText('Próxima')).toHaveLength(1);
      expect(container.querySelectorAll('.m-pulse')).toHaveLength(1);
    });

    it('moves to the first stage that is not completed', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSelect />);
      expect(screen.getByRole('button', { name: /^Etapa 1: / })).not.toHaveClass('stage-pin--next');
      const second = screen.getByRole('button', { name: /^Etapa 2: / });
      expect(second).toHaveClass('stage-pin--next');
      expect(second).toHaveAccessibleDescription('Não iniciada. Resumo 2. Próxima etapa a jogar');
    });

    it('is absent when every stage is completed', () => {
      useAppStore.setState({
        progress: {
          'stage-1': makeProgress('stage-1'),
          'stage-2': makeProgress('stage-2'),
          'stage-3': makeProgress('stage-3'),
        },
      });
      const { container } = render(<StageSelect />);
      expect(screen.queryByText('Próxima')).not.toBeInTheDocument();
      expect(container.querySelector('.m-pulse')).not.toBeInTheDocument();
      expect(screen.getAllByText('Concluída')).toHaveLength(3);
    });
  });

  it('numbers the waypoints of the map', () => {
    const { container } = render(<StageSelect />);
    expect([...container.querySelectorAll('.m-number')].map((n) => n.textContent)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('shows a stage with a saved design as in progress', () => {
    useAppStore.setState({
      progress: {
        'stage-1': makeProgress('stage-1', { completed: false, stars: 0, bestCost: null }),
      },
    });
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /^Etapa 1: / });
    expect(first).toHaveTextContent('Em andamento');
    expect(within(first).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Etapa 2: Título 2/ })).toBeDisabled();
  });

  it('shows stars and best cost of a completed stage and unlocks the next one', () => {
    useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /Etapa 1: Título 1/ });
    expect(first).toHaveTextContent('Concluída');
    expect(first).toHaveTextContent('Melhor custo: R$ 12.345,67');
    expect(within(first).getByRole('img', { name: '2 de 3 estrelas' })).toBeInTheDocument();
    expect(screen.getAllByText('Concluída')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Etapa 2: Título 2/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('fills the main with water up to the last unlocked stage', () => {
    const { container } = render(<StageSelect />);
    expect(container.querySelectorAll('.m-main--dry')).toHaveLength(2);
    expect(container.querySelectorAll('.m-site--locked')).toHaveLength(2);

    act(() => useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } }));
    expect(container.querySelectorAll('.stage-map__art > .m-main--wet')).toHaveLength(1);
    expect(container.querySelectorAll('.m-main--dry')).toHaveLength(1);
    expect(container.querySelectorAll('.m-site--locked')).toHaveLength(1);
  });

  it('opens an unlocked stage on click', async () => {
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 1: Título 1/ }));
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-1'));
    expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 50 }, 'hazen-williams');
  });

  it('opens a stage with the keyboard, in tab order', async () => {
    const openStage = vi.fn(async () => undefined);
    useAppStore.setState({
      openStage,
      progress: { 'stage-1': makeProgress('stage-1') },
    });
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Início' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Etapa 2: / })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(openStage).toHaveBeenLastCalledWith('stage-2');
    await user.keyboard(' ');
    expect(openStage).toHaveBeenCalledTimes(2);
  });

  it('does not open a locked stage', async () => {
    const user = userEvent.setup();
    const { container } = render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 2: Título 2/ }));
    await user.click(container.querySelectorAll('.m-hit')[1]!);
    expect(useAppStore.getState().scenario).toBeNull();
  });

  it('opens an unlocked stage from its scenery', async () => {
    const user = userEvent.setup();
    const { container } = render(<StageSelect />);
    await user.click(container.querySelectorAll('.m-hit')[0]!);
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-1'));
  });

  describe('details area', () => {
    it('starts on the furthest unlocked stage', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSelect />);
      expect(details().getByText('Etapa 2: Título 2')).toBeInTheDocument();
      expect(details().getByText('Resumo 2')).toBeInTheDocument();
    });

    it('follows the focused stage', async () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.tab();
      await user.tab();
      expect(details().getByText('Etapa 1: Título 1')).toBeInTheDocument();
      expect(details().getByText('Resumo 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveClass('stage-pin--active');
    });

    it('shows a locked stage under the pointer with the way to unlock it', async () => {
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.hover(screen.getByRole('button', { name: /^Etapa 3: / }).closest('li')!);
      expect(details().getByText('Resumo 3')).toBeInTheDocument();
      expect(details().getByText('Conclua a etapa 2 para liberar.')).toBeInTheDocument();
    });
  });

  it('follows the language', () => {
    useAppStore.setState({ lang: 'en', progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: 'Stage 1: Title 1' });
    expect(first).toHaveTextContent('Completed');
    expect(first).toHaveTextContent('Best cost: R$ 12,345.67');
    expect(
      screen.getByRole('button', { name: 'Stage 3: Title 3. Locked: complete stage 2 to unlock.' }),
    ).toBeDisabled();
  });

  /** Makes the media queries that contain one of `matching` match, as on a phone or tablet. */
  const stubMedia = (...matching: string[]) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.some((part) => query.includes(part)),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

  describe('at phone width', () => {
    beforeEach(() => stubMedia('max-width', 'hover: none'));
    afterEach(() => vi.unstubAllGlobals());

    it('draws one strip per stage with the same buttons', () => {
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stage-map')).toHaveClass('stage-map--tall');
      const strips = container.querySelectorAll('.stage-map__art');
      expect(strips).toHaveLength(3);
      for (const strip of strips) expect(strip).toHaveAttribute('viewBox', '0 0 360 140');
      expect(stageButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Etapa 1: Título 1',
        'Etapa 2: Título 2. Bloqueada: conclua a etapa 1 para liberar.',
        'Etapa 3: Título 3. Bloqueada: conclua a etapa 2 para liberar.',
      ]);
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('shows the summary inside each card, without hover or focus', () => {
      render(<StageSelect />);
      const first = screen.getByRole('button', { name: /^Etapa 1: / });
      expect(within(first).getByText('Resumo 1')).toHaveClass('stage-pin__summary');
      expect(first).toHaveAccessibleDescription('Não iniciada. Resumo 1. Próxima etapa a jogar');
      const third = screen.getByRole('button', { name: /^Etapa 3: / });
      expect(within(third).getByText('Resumo 3')).toHaveClass('stage-pin__summary');
      expect(third).toHaveTextContent('Conclua a etapa 2 para liberar.');
      expect(screen.queryByTestId('stage-details')).not.toBeInTheDocument();
    });

    it('opens a stage with one activation of its card or of its drawing', async () => {
      const openStage = vi.fn(async () => undefined);
      useAppStore.setState({ openStage, progress: { 'stage-1': makeProgress('stage-1') } });
      const user = userEvent.setup();
      const { container } = render(<StageSelect />);
      await user.click(screen.getByRole('button', { name: /^Etapa 2: / }));
      expect(openStage).toHaveBeenLastCalledWith('stage-2');
      await user.click(container.querySelectorAll('.m-hit')[0]!);
      expect(openStage).toHaveBeenLastCalledWith('stage-1');
      await user.click(container.querySelectorAll('.m-hit')[2]!);
      expect(openStage).toHaveBeenCalledTimes(2);
    });

    it('fills the main with water up to the last unlocked stage', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      const { container } = render(<StageSelect />);
      const rows = [...container.querySelectorAll('.stage-map__row')];
      // Road out of 1 and into 2 are wet; out of 2 and into 3 are dry.
      expect(rows.map((row) => row.querySelectorAll('.m-main--wet').length)).toEqual([1, 1, 0]);
      expect(rows.map((row) => row.querySelectorAll('.m-main--dry').length)).toEqual([0, 1, 1]);
      expect(container.querySelectorAll('.m-site--locked')).toHaveLength(1);
      expect(container.querySelectorAll('.m-pulse')).toHaveLength(1);
      expect(rows[1]!.querySelector('.m-pulse')).toBeInTheDocument();
    });
  });

  describe('on a wide touch screen', () => {
    beforeEach(() => stubMedia('hover: none'));
    afterEach(() => vi.unstubAllGlobals());

    it('keeps the wide map and lists the summary of every stage below it', () => {
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stage-map')).not.toHaveClass('stage-map--tall');
      expect(details().getByText('Etapa 1: Título 1')).toBeInTheDocument();
      expect(details().getByText('Resumo 1')).toBeInTheDocument();
      expect(details().getByText('Resumo 2')).toBeInTheDocument();
      expect(details().getByText('Resumo 3')).toBeInTheDocument();
      expect(details().getByText('Conclua a etapa 2 para liberar.')).toBeInTheDocument();
      expect(stageButtons()).toHaveLength(3);
    });
  });
});

describe('map layouts', () => {
  it('spreads the stages left to right on the wide map', () => {
    const { sites, width } = wideLayout(5);
    const xs = sites.map((site) => site.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[0]).toBeGreaterThanOrEqual(150);
    expect(xs[4]).toBeLessThanOrEqual(width - 150);
  });

  it('alternates the sides of the strips of the phone map', () => {
    const { strips, width, height } = stripLayout(5);
    expect(strips.map((strip) => strip.x < width / 2)).toEqual([true, false, true, false, true]);
    for (const strip of strips) {
      // The drawing (about 180 × 120 around the centre) and the waypoint stay inside the strip.
      expect(strip.x - 90).toBeGreaterThanOrEqual(0);
      expect(strip.x + 90).toBeLessThanOrEqual(width);
      expect(strip.y - 60).toBeGreaterThanOrEqual(0);
      expect(strip.y + ROAD_DY + 12).toBeLessThanOrEqual(height);
    }
  });

  it('joins the road of the phone map from one strip to the next', () => {
    const { strips, height } = stripLayout(4);
    expect(strips[0]!.roadIn).toBeNull();
    expect(strips[3]!.roadOut).toBeNull();
    for (let i = 0; i < 3; i++) {
      const from = strips[i]!;
      const to = strips[i + 1]!;
      const node = from.y + ROAD_DY;
      // Out: from the waypoint straight down to the bottom edge.
      expect(from.roadOut).toBe(`M${from.x} ${node}V${height}`);
      // In: from the top edge at the same x to the waypoint of the next stage.
      expect(to.roadIn!.startsWith(`M${from.x} 0C`)).toBe(true);
      expect(to.roadIn!.endsWith(` ${to.x} ${to.y + ROAD_DY}`)).toBe(true);
    }
  });

  it('draws a single stage without a road', () => {
    expect(stripLayout(1).strips).toEqual([{ x: 98, y: 62, roadIn: null, roadOut: null }]);
    expect(stripLayout(0).strips).toEqual([]);
  });

  it('keeps the map light', () => {
    vi.mocked(evaluateInWorker).mockReset();
    resetStore();
    const { container } = render(<StageSelect />);
    expect(container.querySelectorAll('svg *').length).toBeLessThan(300);
  });
});
