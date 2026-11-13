import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadPreferences, savePreferences } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { App } from '../App';
import { mockMatchMedia, type MatchMediaMock } from '../shell/testMatchMedia';
import { PHONE_LANDSCAPE_QUERY, PHONE_QUERY } from '../shell/useMediaQuery';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const PORTRAIT = (query: string) => query === PHONE_QUERY;
const SIDEWAYS = (query: string) => query === PHONE_QUERY || query === PHONE_LANDSCAPE_QUERY;

describe('stage screen on a phone', () => {
  let media: MatchMediaMock;

  beforeEach(async () => {
    await savePreferences({ lang: 'pt', theme: 'system' });
    resetStore(false);
    useAppStore.setState({ screen: 'map' });
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
    media = mockMatchMedia(PORTRAIT);
  });
  afterEach(() => media.restore());

  async function openStage(order: number) {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1 });
    act(() =>
      useAppStore.setState({
        progress: { 'stage-1': makeProgress('stage-1'), 'stage-2': makeProgress('stage-2') },
      }),
    );
    await user.click(screen.getByRole('button', { name: new RegExp(`Etapa ${order}: `) }));
    await user.click(await screen.findByRole('button', { name: 'Continuar' }));
    return user;
  }

  describe('header', () => {
    it('is one row: logo, and a settings menu with glossary, language and theme', async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByRole('button', { name: 'Aquatubos, tela inicial' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Tema' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Glossário' })).not.toBeInTheDocument();

      const settings = screen.getByRole('button', { name: 'Configurações' });
      expect(settings).toHaveAttribute('aria-haspopup', 'menu');
      await user.click(settings);
      const menu = screen.getByRole('menu', { name: 'Configurações' });
      expect(
        within(within(menu).getByRole('group', { name: 'Idioma' })).getAllByRole('menuitemradio'),
      ).toHaveLength(2);
      expect(
        within(within(menu).getByRole('group', { name: 'Tema' })).getAllByRole('menuitemradio'),
      ).toHaveLength(3);

      await user.click(within(menu).getByRole('menuitemradio', { name: 'Escuro' }));
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(settings);
      await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
      expect(document.documentElement.lang).toBe('en');
      await waitFor(async () => expect((await loadPreferences()).lang).toBe('en'));

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.click(screen.getByRole('menuitem', { name: 'Glossary' }));
      expect(screen.getByRole('dialog', { name: 'Glossary' })).toBeInTheDocument();
    });

    it('shows the stage name and an icon button back to the stage list', async () => {
      const user = await openStage(1);
      const header = document.querySelector('.header') as HTMLElement;
      expect(header).toHaveTextContent('Etapa 1');
      expect(header).toHaveTextContent('Título 1');
      await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toHaveFocus();
    });
  });

  describe('layout', () => {
    it('is a fixed frame only while a stage is open', async () => {
      const user = await openStage(1);
      expect(document.querySelector('.app')).toHaveClass('app--shell');
      expect(screen.getByRole('main')).toHaveClass('app__main--shell');
      expect(document.querySelector('.stage')).toHaveClass('stage--phone');
      expect(document.querySelector('.stage')).not.toHaveClass('stage--side');

      await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
      expect(document.querySelector('.app')).not.toHaveClass('app--shell');
    });

    it('keeps one heading with the stage name, which takes the focus', async () => {
      await openStage(1);
      const heading = screen.getByRole('heading', { level: 1, name: 'Etapa 1: Título 1' });
      expect(heading).toHaveAttribute('tabindex', '-1');
    });

    it('puts calculation and checks in the bottom sheet instead of the side column', async () => {
      await openStage(1);
      expect(document.querySelector('.stage__side')).toBeNull();
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(sheet).toHaveAttribute('data-detent', 'peek');
      expect(
        within(sheet).getByRole('button', { name: 'Painel de cálculo: expandir' }),
      ).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows the HUD as one line that opens the figures and the objectives', async () => {
      const user = await openStage(1);
      const hud = screen.getByRole('region', { name: 'Situação do projeto' });
      const summary = within(hud).getByRole('button', { name: /Casas atendidas/ });
      expect(summary).toHaveAttribute('aria-expanded', 'false');
      expect(within(hud).queryByText('Objetivo 1')).not.toBeVisible();
      await user.click(summary);
      expect(summary).toHaveAttribute('aria-expanded', 'true');
      expect(within(hud).getByText('Objetivo 1')).toBeVisible();
      await user.keyboard('{Escape}');
      expect(summary).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the tabs pattern and moves the town / schematic switch next to the tabs', async () => {
      const user = await openStage(3);
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Rede',
        'Tabela',
        'Perfil',
        'Hardy Cross',
        'Bomba',
        '3D',
      ]);
      const row = document.querySelector('.stage__tabs') as HTMLElement;
      const toggle = within(row).getByRole('group', { name: 'Modo de visualização da rede' });
      expect(screen.getAllByRole('group', { name: 'Modo de visualização da rede' })).toHaveLength(
        1,
      );
      await user.click(within(toggle).getByRole('button', { name: 'Esquema' }));
      expect(useAppStore.getState().networkView).toBe('schematic');
      await savePreferences({ networkView: 'town' });

      const network = screen.getByRole('tab', { name: 'Rede' });
      network.focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Tabela' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Tabela' })).toBeInTheDocument();
      // The switch belongs to the network tab only.
      expect(
        screen.queryByRole('group', { name: 'Modo de visualização da rede' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('more actions menu', () => {
    it('holds the briefing, the formula and the reset', async () => {
      const user = await openStage(1);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enunciado' })).not.toBeInTheDocument();

      const more = screen.getByRole('button', { name: 'Mais ações' });
      await user.click(more);
      await user.click(screen.getByRole('menuitem', { name: 'Enunciado' }));
      const briefing = screen.getByRole('dialog', { name: 'Etapa 1: Título 1' });
      await user.click(within(briefing).getByRole('button', { name: 'Continuar' }));

      await user.click(more);
      const formula = screen.getByRole('group', { name: 'Fórmula de perda de carga' });
      expect(
        within(formula).getByRole('menuitemradio', { name: 'Hazen-Williams' }),
      ).toHaveAttribute('aria-checked', 'true');
      await user.click(within(formula).getByRole('menuitemradio', { name: 'Darcy-Weisbach' }));
      expect(useAppStore.getState().formula).toBe('darcy-weisbach');
      expect(useAppStore.getState().stale).toBe(true);

      act(() => useAppStore.getState().setDiameter('T1', 100));
      await user.click(more);
      await user.click(screen.getByRole('menuitem', { name: 'Restaurar diâmetros' }));
      expect(useAppStore.getState().diameters).toEqual({ T1: 50 });
    });
  });

  describe('Calcular / Verificar', () => {
    it('sits in the bar of the sheet, shows the stale state and verifies', async () => {
      const user = await openStage(1);
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(within(sheet).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();

      act(() => useAppStore.getState().setDiameter('T1', 100));
      const again = within(sheet).getByRole('button', { name: 'Recalcular' });
      expect(screen.getByText(/O projeto mudou desde/)).toBeInTheDocument();

      vi.mocked(evaluateInWorker).mockClear();
      await user.click(again);
      expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 100 }, 'hazen-williams');
      expect(
        await within(sheet).findByRole('button', { name: 'Calcular / Verificar' }),
      ).toBeEnabled();
      expect(screen.queryByText(/O projeto mudou desde/)).not.toBeInTheDocument();
    });
  });

  describe('held sideways', () => {
    it('shows the panel beside the view, always open', async () => {
      media.set(SIDEWAYS);
      await openStage(1);
      expect(document.querySelector('.stage')).toHaveClass('stage--phone', 'stage--side');
      const panel = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(panel).not.toHaveAttribute('data-detent');
      expect(within(panel).getByRole('group', { name: 'Seção do painel' })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();
    });
  });

  it('goes back to the desktop layout when the viewport grows', async () => {
    await openStage(1);
    act(() => media.set(() => false));
    expect(document.querySelector('.stage')).not.toHaveClass('stage--phone');
    expect(document.querySelector('.stage__side')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Fórmula de perda de carga' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações' })).not.toBeInTheDocument();
  });
});
