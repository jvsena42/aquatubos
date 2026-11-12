import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { StageSelect } from './StageSelect';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

describe('StageSelect', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('lists every stage in order with title and summary', () => {
    render(<StageSelect />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Título 1');
    expect(items[0]).toHaveTextContent('Resumo 1');
    expect(items[2]).toHaveTextContent('Título 3');
  });

  it('unlocks only the first stage when there is no progress', () => {
    render(<StageSelect />);
    expect(screen.getByRole('button', { name: /Etapa 1: Título 1/ })).toBeEnabled();
    const second = screen.getByRole('button', { name: /Etapa 2: Título 2/ });
    expect(second).toBeDisabled();
    expect(second).toHaveAccessibleName(
      'Etapa 2: Título 2. Bloqueada: conclua a etapa 1 para liberar.',
    );
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('shows stars and best cost of a completed stage and unlocks the next one', () => {
    useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /Etapa 1: Título 1/ });
    expect(first).toHaveTextContent('Concluída');
    expect(first).toHaveTextContent('Melhor custo: R$ 12.345,67');
    expect(screen.getByRole('img', { name: '2 de 3 estrelas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Etapa 2: Título 2/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('opens an unlocked stage on click', async () => {
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 1: Título 1/ }));
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-1'));
    expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 50 }, 'hazen-williams');
  });

  it('does not open a locked stage', async () => {
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 2: Título 2/ }));
    expect(useAppStore.getState().scenario).toBeNull();
  });
});
