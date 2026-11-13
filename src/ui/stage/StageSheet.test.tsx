import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { fixtureScenarios, makeEvaluation, makeIssue, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { StageSheet } from './StageSheet';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const stage1 = fixtureScenarios[0]!;

const failing = () =>
  makeEvaluation('stage-1', {
    passed: false,
    stars: 0,
    report: {
      passed: false,
      issues: [
        makeIssue(),
        makeIssue({ elementType: 'pipe', elementId: 'T1', check: 'maxVelocity' }),
      ],
      staticPressure: {},
    },
  });

const sheet = () => screen.getByRole('region', { name: 'Cálculo e verificações' });
const detent = () => sheet().getAttribute('data-detent');
const handle = () => sheet().querySelector<HTMLButtonElement>('.sheet__handle')!;
const pressed = () =>
  within(screen.getByRole('group', { name: 'Seção do painel' })).getByRole('button', {
    pressed: true,
  });
const verifyButton = () => sheet().querySelector<HTMLButtonElement>('.sheet__verify')!;

function open(evaluation = failing()) {
  useAppStore.setState({ scenario: stage1, diameters: { T1: 50 }, evaluation });
}

describe('StageSheet', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('renders nothing without an open stage', () => {
    const { container } = render(<StageSheet side={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('bar', () => {
    it('shows the state of the checks while nothing is selected', () => {
      open();
      render(<StageSheet side={false} />);
      expect(detent()).toBe('peek');
      expect(handle()).toHaveAccessibleName('Painel de cálculo: expandir');
      expect(handle()).toHaveAccessibleDescription('Verificações: 2 pendências');
    });

    it('counts one issue in the singular and says when the design passed', () => {
      open(
        makeEvaluation('stage-1', {
          passed: false,
          report: { passed: false, issues: [makeIssue()], staticPressure: {} },
        }),
      );
      render(<StageSheet side={false} />);
      expect(handle()).toHaveAccessibleDescription('Verificações: 1 pendência');
      act(() => useAppStore.setState({ evaluation: makeEvaluation('stage-1') }));
      expect(handle()).toHaveAccessibleDescription('Verificações: Aprovado');
    });

    it('says when there is no result yet and when it is out of date', () => {
      useAppStore.setState({ scenario: stage1, diameters: { T1: 50 }, evaluation: null });
      render(<StageSheet side={false} />);
      expect(handle()).toHaveAccessibleDescription('Verificações: Ainda não verificado');
      act(() => useAppStore.setState({ evaluation: failing(), stale: true }));
      expect(handle()).toHaveAccessibleDescription('Verificações: Desatualizado');
    });

    it('names the selected element, with the diameter of a pipe', () => {
      open();
      useAppStore.setState({ selection: { type: 'pipe', id: 'T1' }, diameters: { T1: 75 } });
      render(<StageSheet side={false} />);
      expect(handle()).toHaveAccessibleDescription('Cálculo: Trecho T1 · DN 75');
      act(() => useAppStore.setState({ selection: { type: 'node', id: 'N1' } }));
      // The selection opened the sheet; two presses of the handle close it again.
      act(() => handle().click());
      act(() => handle().click());
      expect(detent()).toBe('peek');
      expect(handle()).toHaveAccessibleDescription('Cálculo: Nó N1');
      act(() => useAppStore.setState({ selection: { type: 'reservoir', id: 'R1' } }));
      act(() => handle().click());
      act(() => handle().click());
      expect(handle()).toHaveAccessibleDescription('Cálculo: Reservatório R1');
    });
  });

  describe('following the game', () => {
    it('rises to half on the calculation when an element is selected', () => {
      open();
      render(<StageSheet side={false} />);
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      expect(detent()).toBe('half');
      expect(pressed()).toHaveTextContent('Cálculo');
      expect(screen.getByRole('heading', { name: 'Trecho T1' })).toBeInTheDocument();
      // Open on the calculation, the bar keeps the checks in sight.
      expect(handle()).toHaveAccessibleDescription('Verificações: 2 pendências');
    });

    it('rises again when the same element is picked after closing', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      await user.click(screen.getByRole('button', { name: 'Recolher painel' }));
      expect(detent()).toBe('peek');
      expect(handle()).toHaveAccessibleDescription('Cálculo: Trecho T1 · DN 50');
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      expect(detent()).toBe('half');
    });

    it('stays where it is when the selection is cleared', () => {
      open();
      render(<StageSheet side={false} />);
      act(() => useAppStore.getState().select(null));
      expect(detent()).toBe('peek');
    });

    it('shows the checks at half after a verification that fails', async () => {
      const user = userEvent.setup();
      open();
      vi.mocked(evaluateInWorker).mockImplementation(async () => failing());
      render(<StageSheet side={false} />);
      await user.click(verifyButton());
      await waitFor(() => expect(detent()).toBe('half'));
      expect(pressed()).toHaveTextContent('Verificações');
      expect(screen.getByText('Reprovado')).toBeInTheDocument();
      expect(screen.queryByText('Etapa aprovada')).not.toBeInTheDocument();
    });

    it('goes back to peek after a verification that passes and offers the next stage', async () => {
      const user = userEvent.setup();
      open();
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSheet side={false} />);
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      expect(detent()).toBe('half');
      await user.click(verifyButton());
      await waitFor(() => expect(detent()).toBe('peek'));

      const notice = screen.getByText('Etapa aprovada').closest('.sheet__passed') as HTMLElement;
      expect(within(notice).getByRole('img', { name: '2 de 3 estrelas' })).toBeInTheDocument();
      await user.click(within(notice).getByRole('button', { name: 'Próxima etapa' }));
      expect(useAppStore.getState().scenario?.id).toBe('stage-2');
    });

    it('lets the passed notice be dismissed and drops it when the design changes', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      await user.click(verifyButton());
      await screen.findByText('Etapa aprovada');
      await user.click(screen.getByRole('button', { name: 'Dispensar' }));
      expect(screen.queryByText('Etapa aprovada')).not.toBeInTheDocument();

      await user.click(verifyButton());
      await screen.findByText('Etapa aprovada');
      act(() => useAppStore.getState().setDiameter('T1', 100));
      expect(screen.queryByText('Etapa aprovada')).not.toBeInTheDocument();
    });

    it('goes to the calculation of the element of an issue that is tapped', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      await user.click(handle());
      expect(pressed()).toHaveTextContent('Verificações');
      await user.click(screen.getByRole('button', { name: /Velocidade máxima/ }));
      expect(pressed()).toHaveTextContent('Cálculo');
      expect(screen.getByRole('heading', { name: 'Trecho T1' })).toBeInTheDocument();
    });
  });

  describe('sections', () => {
    it('opens on the checks without a selection and switches with the segmented control', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      await user.click(handle());
      expect(detent()).toBe('half');
      expect(pressed()).toHaveTextContent('Verificações');
      expect(screen.getByText('Reprovado')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cálculo' }));
      expect(pressed()).toHaveTextContent('Cálculo');
      expect(screen.queryByText('Reprovado')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Resumo da rede' })).toBeInTheDocument();
    });
  });

  describe('Calcular / Verificar', () => {
    it('runs the verification of the store', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      expect(verifyButton()).toHaveAccessibleName('Calcular / Verificar');
      await user.click(verifyButton());
      expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 50 }, 'hazen-williams');
      await waitFor(() => expect(useAppStore.getState().verifiedAt).not.toBeNull());
    });

    it('shows the stale state on the button', () => {
      open();
      render(<StageSheet side={false} />);
      expect(verifyButton()).not.toHaveAttribute('data-stale');
      act(() => useAppStore.getState().setDiameter('T1', 100));
      expect(verifyButton()).toHaveAccessibleName('Recalcular');
      expect(verifyButton()).toHaveAttribute('data-stale', 'true');
      expect(verifyButton().querySelector('svg')).not.toBeNull();
    });

    it('is disabled while solving', () => {
      open();
      useAppStore.setState({ solving: true, stale: true });
      render(<StageSheet side={false} />);
      expect(verifyButton()).toBeDisabled();
      expect(verifyButton()).toHaveAccessibleName('Calculando…');
    });

    it('stays in the bar at every detent', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side={false} />);
      for (const expected of ['half', 'full', 'peek']) {
        await user.click(handle());
        expect(detent()).toBe(expected);
        expect(verifyButton().closest('.sheet__bar')).not.toBeNull();
        expect(verifyButton().closest('[inert]')).toBeNull();
      }
    });
  });

  describe('side panel', () => {
    it('is always open and shows the result of a verification, passed or not', async () => {
      const user = userEvent.setup();
      open();
      render(<StageSheet side />);
      expect(sheet()).not.toHaveAttribute('data-detent');
      expect(sheet().querySelector('.sheet__handle')).toBeNull();
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      expect(pressed()).toHaveTextContent('Cálculo');

      await user.click(verifyButton());
      await waitFor(() => expect(pressed()).toHaveTextContent('Verificações'));
      expect(screen.getByText('Aprovado')).toBeInTheDocument();
    });
  });
});
