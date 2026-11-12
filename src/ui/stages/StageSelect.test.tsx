import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { tallLayout, wideLayout } from './mapLayout';
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
    const buttons = screen.getAllByRole('button');
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
      'Não iniciada. Resumo 1',
    );
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

  describe('at phone width', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('draws the map as a vertical path with the same buttons', () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stage-map')).toHaveClass('stage-map--tall');
      expect(container.querySelector('.stage-map__art')).toHaveAttribute('viewBox', '0 0 360 540');
      expect(screen.getAllByRole('button')).toHaveLength(3);
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

  it('stacks the stages top to bottom on the tall map', () => {
    const { sites, height } = tallLayout(5);
    const ys = sites.map((site) => site.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[4]).toBeLessThan(height);
  });

  it('keeps the map light', () => {
    vi.mocked(evaluateInWorker).mockReset();
    resetStore();
    const { container } = render(<StageSelect />);
    expect(container.querySelectorAll('svg *').length).toBeLessThan(300);
  });
});
