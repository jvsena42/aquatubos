import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadPreferences, savePreferences } from '../persistence/db';
import { useAppStore } from '../state/store';
import { makeEvaluation, makeProgress } from '../test/fixtures';
import { resetStore } from '../test/store';
import { evaluateInWorker } from '../worker/client';
import { App } from './App';
import { Header } from './shell/Header';

const STALE = 'Resultado desatualizado: recalcule.';

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

type User = ReturnType<typeof userEvent.setup>;

/** Chooses an item of the header menu; it is named "Menu" in both languages. */
async function chooseInMenu(user: User, role: 'menuitem' | 'menuitemradio', name: string) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(screen.getByRole('menu', { name: 'Menu' })).getByRole(role, { name }));
}

/** The checked option of a radio group of the header menu, read with the menu open. */
async function checkedInMenu(user: User, group: string): Promise<string | null> {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  const checked = within(screen.getByRole('group', { name: group })).getByRole('menuitemradio', {
    checked: true,
  });
  const text = checked.textContent;
  await user.keyboard('{Escape}');
  return text;
}

describe('App', () => {
  beforeEach(() => {
    resetStore(false);
    // These tests start on the stage map; the title screen has its own tests.
    useAppStore.setState({ screen: 'map' });
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('shows a loading state and then the stage list', async () => {
    render(<App />);
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('switches the visible text and the document language from the menu', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'Português');
    expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('pt-BR');

    await chooseInMenu(user, 'menuitemradio', 'English');
    expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
    expect(await checkedInMenu(user, 'Language')).toBe('English');
    expect(screen.getByText('Title 1')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    await waitFor(async () => expect((await loadPreferences()).lang).toBe('en'));
  });

  it('sets and removes data-theme from the menu', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'Português');

    await chooseInMenu(user, 'menuitemradio', 'Escuro');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(await checkedInMenu(user, 'Tema')).toBe('Escuro');
    await chooseInMenu(user, 'menuitemradio', 'Claro');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await chooseInMenu(user, 'menuitemradio', 'Sistema');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(await checkedInMenu(user, 'Tema')).toBe('Sistema');
  });

  it('has only the logo and one menu button in the header', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'Português');
    const header = document.querySelector('.header') as HTMLElement;
    expect(
      within(header)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Aquatubos, tela inicial', 'Menu']);
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-haspopup', 'menu');

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('menu', { name: 'Menu' });
    expect(
      [...menu.querySelectorAll('[role^="menuitem"]')].map((item) => item.textContent),
    ).toEqual([
      'Como jogar',
      'Glossário',
      'Português',
      'English',
      'Sistema',
      'Claro',
      'Escuro',
      'Sobre',
    ]);
    // Every item is reachable with the arrow keys, in order, and Escape returns the focus.
    expect(within(menu).getByRole('menuitem', { name: 'Como jogar' })).toHaveFocus();
    for (const name of ['Glossário', 'Português', 'English', 'Sistema', 'Claro', 'Escuro']) {
      await user.keyboard('{ArrowDown}');
      expect(within(menu).getByText(name).closest('button')).toHaveFocus();
    }
    await user.keyboard('{End}');
    expect(within(menu).getByRole('menuitem', { name: 'Sobre' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });

  it('opens how to play, the glossary and about from the menu', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'Português');
    await chooseInMenu(user, 'menuitem', 'Glossário');
    const glossary = screen.getByRole('dialog', { name: 'Glossário' });
    await user.click(within(glossary).getByRole('button', { name: 'Fechar' }));

    await chooseInMenu(user, 'menuitem', 'Como jogar');
    const howTo = screen.getByRole('dialog', { name: 'Como jogar' });
    await user.click(within(howTo).getAllByRole('button', { name: 'Fechar' })[0]!);

    await chooseInMenu(user, 'menuitem', 'Sobre');
    expect(screen.getByRole('dialog', { name: 'Sobre o Aquatubos' })).toBeInTheDocument();
  });

  it('places extra menu items between the theme and about', async () => {
    const user = userEvent.setup();
    const install = vi.fn();
    render(
      <Header
        extraItems={[{ kind: 'action', id: 'install', label: 'Instalar app', onSelect: install }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const items = [...document.querySelectorAll('[role^="menuitem"]')].map(
      (item) => item.textContent,
    );
    expect(items.slice(-3)).toEqual(['Escuro', 'Instalar app', 'Sobre']);
    await user.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    expect(install).toHaveBeenCalledTimes(1);
  });

  it('opens a stage with its briefing and goes back to the stage list', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'Português');
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

describe('App from the title screen', () => {
  beforeEach(async () => {
    // Earlier tests leave their language and theme saved.
    await savePreferences({ lang: 'pt', theme: 'system' });
    resetStore(false);
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  const heading = (name: string | RegExp) => screen.getByRole('heading', { level: 1, name });

  it('opens on the title screen and leaves the focus alone', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Aquatubos' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Etapas' })).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
    expect(screen.getByRole('main')).toHaveClass('app__main--bleed');
  });

  it('goes from the title screen to the map, a stage and back, focusing each heading', async () => {
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(heading('Etapas')).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveClass('app__main--bleed');

    await user.click(screen.getByRole('button', { name: /^Etapa 1: / }));
    const briefing = await screen.findByRole('dialog', { name: 'Etapa 1: Título 1' });
    await user.click(within(briefing).getByRole('button', { name: 'Continuar' }));
    expect(heading(/Título 1/)).toHaveAttribute('tabindex', '-1');

    await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
    expect(heading('Etapas')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Início' }));
    expect(heading('Aquatubos')).toHaveFocus();
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('focuses the stage heading when a stage opens again', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    await user.click(screen.getByRole('button', { name: /^Etapa 1: / }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));

    // The stage screen is already loaded, so its heading is there as soon as the stage opens.
    await user.click(screen.getByRole('button', { name: /^Etapa 1: / }));
    expect(heading(/Título 1/)).toHaveFocus();
  });

  it('continues a saved stage straight from the title screen', async () => {
    const user = await renderApp();
    act(() =>
      useAppStore.setState({
        progress: { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Continuar: Etapa 3: Título 3' }));
    expect(await screen.findByRole('dialog', { name: 'Etapa 3: Título 3' })).toBeInTheDocument();
    expect(useAppStore.getState().scenario?.id).toBe('stage-3');

    // Leaving a stage always goes to the map.
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
    expect(heading('Etapas')).toHaveFocus();
  });

  it('goes to the title screen from the header logo, on the map and in a stage', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    await user.click(screen.getByRole('button', { name: 'Aquatubos, tela inicial' }));
    expect(heading('Aquatubos')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    await user.click(screen.getByRole('button', { name: /^Etapa 1: / }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(screen.getByRole('button', { name: 'Aquatubos, tela inicial' }));
    expect(heading('Aquatubos')).toHaveFocus();
    expect(useAppStore.getState().scenario).toBeNull();
    expect(useAppStore.getState().screen).toBe('home');
  });

  it('keeps language and theme reachable on the title screen', async () => {
    const user = await renderApp();
    await chooseInMenu(user, 'menuitemradio', 'English');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText("Design the town's water network")).toBeInTheDocument();
    await chooseInMenu(user, 'menuitemradio', 'Dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await savePreferences({ lang: 'pt', theme: 'system' });
  });

  it('restarts the enter animation on each screen', async () => {
    const user = await renderApp();
    const first = document.querySelector('.screen');
    expect(first).toContainElement(heading('Aquatubos'));
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    const second = document.querySelector('.screen');
    expect(second).not.toBe(first);
    expect(second).toContainElement(heading('Etapas'));
  });
});

describe('StageScreen', () => {
  beforeEach(() => {
    resetStore(false);
    // These tests start on the stage map; the title screen has its own tests.
    useAppStore.setState({ screen: 'map' });
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
    expect(screen.getByRole('group', { name: 'Modo de visualização da rede' })).toBeInTheDocument();

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
    expect(screen.queryByText(STALE)).not.toBeInTheDocument();
    const verify = screen.getByRole('button', { name: 'Calcular / Verificar' });
    expect(verify).not.toHaveAttribute('data-stale');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Fórmula de perda de carga' }),
      'darcy-weisbach',
    );
    expect(useAppStore.getState().formula).toBe('darcy-weisbach');
    // The button keeps its name and gets a stale mark; the words are for screen readers.
    expect(screen.getByText(STALE)).toHaveAttribute('role', 'status');
    expect(verify).toHaveAttribute('data-stale', 'true');

    vi.mocked(evaluateInWorker).mockClear();
    await user.click(screen.getByRole('button', { name: 'Calcular / Verificar' }));
    expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 75 }, 'darcy-weisbach');
    await waitFor(() => expect(screen.queryByText(STALE)).not.toBeInTheDocument());
  });

  it('disables the verify button while solving', async () => {
    await openStage(1);
    useAppStore.setState({ solving: true });
    expect(await screen.findByRole('button', { name: 'Calculando…' })).toBeDisabled();
  });
});
