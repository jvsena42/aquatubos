import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { fixtureScenarios, makeEvaluation, makeIssue, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { ChecksPanel } from './ChecksPanel';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const [stage1, stage2, stage3] = fixtureScenarios as [
  (typeof fixtureScenarios)[number],
  (typeof fixtureScenarios)[number],
  (typeof fixtureScenarios)[number],
];

describe('ChecksPanel', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('says the stage was not verified when there is no evaluation', () => {
    useAppStore.setState({ scenario: stage1 });
    render(<ChecksPanel />);
    expect(screen.getByText('Ainda não verificado')).toBeInTheDocument();
    expect(screen.queryByText(/Pendências/)).not.toBeInTheDocument();
  });

  it('shows the failed status and the issues with severity labels', () => {
    useAppStore.setState({
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        stars: 0,
        report: {
          passed: false,
          staticPressure: {},
          issues: [
            makeIssue(),
            makeIssue({
              check: 'minVelocity',
              severity: 'warning',
              elementType: 'pipe',
              elementId: 'T1',
              explanation: { pt: 'Velocidade baixa no trecho T1.', en: 'Low velocity in T1.' },
            }),
          ],
        },
      }),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Reprovado')).toBeInTheDocument();
    expect(screen.getByText('Pendências (2)')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByText('Erro')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Pressão dinâmica mínima')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Pressão abaixo do mínimo no nó N1.')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Aviso')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Trecho T1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Próxima etapa/ })).not.toBeInTheDocument();
  });

  it('selects the element of an issue on click', async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        report: {
          passed: false,
          staticPressure: {},
          issues: [makeIssue({ elementType: 'pipe', elementId: 'T1' })],
        },
      }),
    });
    render(<ChecksPanel />);
    await user.click(screen.getByRole('button', { name: /Trecho T1/ }));
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T1' });
  });

  it('renders a network-wide issue without a button', () => {
    useAppStore.setState({
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        report: {
          passed: false,
          staticPressure: {},
          issues: [makeIssue({ check: 'convergence', elementType: 'network', elementId: '' })],
        },
      }),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Convergência do cálculo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses the explanation in the current language', () => {
    useAppStore.setState({
      lang: 'en',
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        report: { passed: false, staticPressure: {}, issues: [makeIssue()] },
      }),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pressure below minimum at N1.')).toBeInTheDocument();
  });

  it('shows success, cost, budget, stars and the reference comparison when passed', () => {
    useAppStore.setState({
      scenario: stage2,
      progress: { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') },
      evaluation: makeEvaluation('stage-2', { cost: 1100, stars: 2 }),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText('A rede atende a todos os critérios desta etapa.')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.100,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.000,00')).toBeInTheDocument();
    expect(screen.getByText('Dentro do orçamento')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 de 3 estrelas' })).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(
      screen.getByText('Seu projeto custa 10,0% a mais que a solução de referência.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nenhuma pendência encontrada.')).toBeInTheDocument();
  });

  it('flags a design over budget', () => {
    useAppStore.setState({
      scenario: stage2,
      evaluation: makeEvaluation('stage-2', { cost: 2500, withinBudget: false, passed: false }),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Acima do orçamento')).toBeInTheDocument();
    expect(screen.getByText('Reprovado')).toBeInTheDocument();
    expect(screen.queryByText('Custo de referência')).not.toBeInTheDocument();
  });

  it('hides cost when the stage has no budget and no cost feature', () => {
    useAppStore.setState({ scenario: stage1, evaluation: makeEvaluation('stage-1') });
    render(<ChecksPanel />);
    expect(screen.queryByText('Custo')).not.toBeInTheDocument();
    expect(screen.queryByText('Orçamento')).not.toBeInTheDocument();
  });

  it('opens the next stage from the success state', async () => {
    const user = userEvent.setup();
    useAppStore.setState({
      scenario: stage1,
      progress: { 'stage-1': makeProgress('stage-1') },
      evaluation: makeEvaluation('stage-1'),
    });
    render(<ChecksPanel />);
    await user.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-2'));
  });

  it('has no next stage button on the last stage', () => {
    useAppStore.setState({
      scenario: stage3,
      progress: { 'stage-3': makeProgress('stage-3') },
      evaluation: makeEvaluation('stage-3'),
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima etapa' })).not.toBeInTheDocument();
  });

  it('marks the result as out of date when the design changed', () => {
    useAppStore.setState({
      scenario: stage1,
      progress: { 'stage-1': makeProgress('stage-1') },
      evaluation: makeEvaluation('stage-1'),
      stale: true,
    });
    render(<ChecksPanel />);
    expect(screen.getByText('Desatualizado')).toBeInTheDocument();
    expect(screen.queryByText('Aprovado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima etapa' })).not.toBeInTheDocument();
  });

  it('shows the error from the store', () => {
    useAppStore.setState({ scenario: stage1, error: 'not implemented' });
    render(<ChecksPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível calcular');
    expect(screen.getByRole('alert')).toHaveTextContent('not implemented');
  });
});
