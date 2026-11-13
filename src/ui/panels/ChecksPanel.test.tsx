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
    expect(screen.getByText('Não verificado')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/pendência/i)).not.toBeInTheDocument();
  });

  it('shows the failed status and one line per issue: icon, short label, element, value', () => {
    useAppStore.setState({
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        stars: 0,
        report: {
          passed: false,
          staticPressure: {},
          issues: [
            makeIssue({ value: 9.4 }),
            makeIssue({
              check: 'maxVelocity',
              severity: 'warning',
              elementType: 'pipe',
              elementId: 'T1',
              value: 4.9,
              limit: 3.5,
              explanation: { pt: 'Velocidade alta no trecho T1.', en: 'High velocity in T1.' },
            }),
          ],
        },
      }),
    });
    render(<ChecksPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Reprovado2 pendências');
    const items = within(screen.getByRole('list', { name: 'Pendências' })).getAllByRole('listitem');
    expect(within(items[0]!).getByRole('button', { name: /N1/ })).toHaveTextContent(
      'Erro: Pressão mín.N1Nó N19,4 mca',
    );
    expect(within(items[1]!).getByRole('button', { name: /T1/ })).toHaveTextContent(
      'Aviso: Velocidade máx.T1Trecho T14,90 m/s',
    );
    // The explanation is not in the default view.
    expect(screen.queryByText('Pressão abaixo do mínimo no nó N1.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Próxima etapa/ })).not.toBeInTheDocument();
  });

  it('puts the explanation of the engine and the limit behind the help of the line', async () => {
    const user = userEvent.setup();
    const issue = makeIssue({ value: 9.4 });
    useAppStore.setState({
      scenario: stage1,
      evaluation: makeEvaluation('stage-1', {
        passed: false,
        report: { passed: false, staticPressure: {}, issues: [issue] },
      }),
    });
    render(<ChecksPanel />);
    await user.click(screen.getByRole('button', { name: 'Ajuda: Pressão mín.' }));
    const help = screen.getByRole('note', { name: 'Ajuda: Pressão mín.' });
    expect(help.querySelector('.issue__explanation')!.textContent).toBe(issue.explanation.pt);
    expect(help).toHaveTextContent('Limite: mínimo de 10,0 mca (ABNT NBR 12218:2017).');
    // Opening the help does not select the element.
    expect(useAppStore.getState().selection).toBeNull();
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

  it('renders a network-wide issue without a select button', () => {
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
    expect(screen.getByText('Convergência')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Ajuda: Convergência']);
  });

  it('uses the current language for labels and explanation', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByText('1 issue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Help: Min. pressure' }));
    expect(screen.getByText('Pressure below minimum at N1.')).toBeInTheDocument();
    expect(screen.getByText('Limit: at least 10.0 mca (ABNT NBR 12218:2017).')).toBeInTheDocument();
  });

  it('keeps the passed state to one line: cost, budget and stars are in the HUD', () => {
    useAppStore.setState({
      scenario: stage2,
      progress: { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') },
      evaluation: makeEvaluation('stage-2', { cost: 1100, stars: 2 }),
    });
    render(<ChecksPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('AprovadoSem pendências');
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /estrelas/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/referência|orçamento/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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
