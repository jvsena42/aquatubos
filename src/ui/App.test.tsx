import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadPreferences } from '../persistence/db';
import { useAppStore } from '../state/store';
import { makeEvaluation, makeProgress } from '../test/fixtures';
import { resetStore } from '../test/store';
import { evaluateInWorker } from '../worker/client';
import { App } from './App';

vi.mock('../scenarios', async () => {
  const { fixtureScenarios } = await import('../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../worker/client', () => ({ evaluateInWorker: vi.fn() }));

async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { level: 1 });
  return user;
}

describe('App', () => {
  beforeEach(() => {
    resetStore(false);
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('shows a loading state and then the stage list', async () => {
    render(<App />);
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('switches the visible text and the document language with the language toggle', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Português' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Title 1')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    await waitFor(async () => expect((await loadPreferences()).lang).toBe('en'));
  });

  it('sets and removes data-theme with the theme toggle', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Português' }));
    const theme = within(screen.getByRole('group', { name: 'Tema' }));

    await user.click(theme.getByRole('button', { name: 'Escuro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(theme.getByRole('button', { name: 'Claro' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await user.click(theme.getByRole('button', { name: 'Sistema' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(theme.getByRole('button', { name: 'Sistema' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the glossary from the header', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Português' }));
    await user.click(screen.getByRole('button', { name: 'Glossário' }));
    expect(screen.getByRole('dialog', { name: 'Glossário' })).toBeInTheDocument();
  });

  it('opens a stage with its briefing and goes back to the stage list', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Português' }));
    await user.click(screen.getByRole('button', { name: /Etapa 1: Título 1/ }));

    const briefing = await screen.findByRole('dialog', { name: 'Etapa 1: Título 1' });
    expect(briefing).toHaveTextContent('Enunciado 1');
    expect(briefing).toHaveTextContent('Objetivo 1');
    await user.click(within(briefing).getByRole('button', { name: 'Continuar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enunciado' }));
    expect(screen.getByRole('dialog', { name: 'Etapa 1: Título 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toBeInTheDocument();
    expect(useAppStore.getState().scenario).toBeNull();
  });
});

describe('StageScreen', () => {
  beforeEach(() => {
    resetStore(false);
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  async function openStage(order: number) {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    useAppStore.setState({
      lang: 'pt',
      progress: { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') },
    });
    await user.click(screen.getByRole('button', { name: new RegExp(`Etapa ${order}: `) }));
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    return user;
  }

  it('shows only the tabs of the stage features', async () => {
    await openStage(1);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Rede',
      'Tabela',
      '3D',
    ]);
  });

  it('shows profile, Hardy Cross and pump tabs when the stage has them', async () => {
    await openStage(3);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Rede',
      'Tabela',
      'Perfil',
      'Hardy Cross',
      'Bomba',
      '3D',
    ]);
  });

  it('moves between tabs with the arrow keys and loads the 3D view on demand', async () => {
    const user = await openStage(1);
    const network = screen.getByRole('tab', { name: 'Rede' });
    expect(network).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('group', { name: 'Desenho da rede' })).toBeInTheDocument();

    network.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tabela' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Tabela' })).toHaveAttribute('aria-selected', 'true');
    expect(network).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Tabela' })).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: '3D' })).toHaveFocus();
    expect(await screen.findByText(/WebGL/)).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(network).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: '3D' })).toHaveFocus();
  });

  it('marks the result as stale when the formula changes and verifies again', async () => {
    const user = await openStage(1);
    expect(screen.queryByText(/O projeto mudou desde/)).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Fórmula de perda de carga' }),
      'darcy-weisbach',
    );
    expect(useAppStore.getState().formula).toBe('darcy-weisbach');
    expect(screen.getByText(/O projeto mudou desde/)).toBeInTheDocument();

    vi.mocked(evaluateInWorker).mockClear();
    await user.click(screen.getByRole('button', { name: 'Calcular / Verificar' }));
    expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 75 }, 'darcy-weisbach');
    await waitFor(() =>
      expect(screen.queryByText(/O projeto mudou desde/)).not.toBeInTheDocument(),
    );
  });

  it('disables the verify button while solving', async () => {
    await openStage(1);
    useAppStore.setState({ solving: true });
    expect(await screen.findByRole('button', { name: 'Calculando…' })).toBeDisabled();
  });
});
