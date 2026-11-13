import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadPreferences, savePreferences } from '../../persistence/db';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { App } from '../App';
import {
  LANDSCAPE_QUERY,
  PHONE_LANDSCAPE_QUERY,
  PHONE_QUERY,
  UP_TO_TABLET_QUERY,
} from '../shell/breakpoints';
import { mockMatchMedia, type MatchMediaMock } from '../shell/testMatchMedia';
import { SHEET_HALF } from './sheetState';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const among =
  (...queries: string[]) =>
  (query: string) =>
    queries.includes(query);
const PORTRAIT = among(PHONE_QUERY, UP_TO_TABLET_QUERY);
const SIDEWAYS = among(PHONE_QUERY, UP_TO_TABLET_QUERY, PHONE_LANDSCAPE_QUERY, LANDSCAPE_QUERY);
const TABLET_PORTRAIT = among(UP_TO_TABLET_QUERY);
const TABLET_LANDSCAPE = among(UP_TO_TABLET_QUERY, LANDSCAPE_QUERY);

let media: MatchMediaMock;

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

function setUp(matches: (query: string) => boolean) {
  beforeEach(async () => {
    await savePreferences({ lang: 'pt', theme: 'system' });
    resetStore(false);
    useAppStore.setState({ screen: 'map' });
    document.documentElement.removeAttribute('data-theme');
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
    media = mockMatchMedia(matches);
  });
  afterEach(() => media.restore());
}

const header = () => document.querySelector('.header') as HTMLElement;
const stage = () => document.querySelector('.stage') as HTMLElement;

describe('stage screen on a phone', () => {
  setUp(PORTRAIT);

  describe('header', () => {
    it('is one row with the logo and one menu: glossary, language and theme', async () => {
      const user = userEvent.setup();
      render(<App />);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.getByRole('button', { name: 'Aquatubos, tela inicial' })).toBeInTheDocument();
      expect(within(header()).getAllByRole('button')).toHaveLength(2);

      const menuButton = screen.getByRole('button', { name: 'Menu' });
      expect(menuButton).toHaveAttribute('aria-haspopup', 'menu');
      await user.click(menuButton);
      const menu = screen.getByRole('menu', { name: 'Menu' });
      await user.click(within(menu).getByRole('menuitemradio', { name: 'Escuro' }));
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();

      await user.click(menuButton);
      await user.click(screen.getByRole('menuitemradio', { name: 'English' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
      expect(document.documentElement.lang).toBe('en');
      await waitFor(async () => expect((await loadPreferences()).lang).toBe('en'));

      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: 'Glossary' }));
      expect(screen.getByRole('dialog', { name: 'Glossary' })).toBeInTheDocument();
    });

    it('holds back, the stage name, the HUD, the briefing and the menu in one row', async () => {
      const user = await openStage(1);
      // No logo here: the row is back, name over numbers, briefing, menu.
      expect(screen.queryByRole('button', { name: 'Aquatubos, tela inicial' })).toBeNull();
      expect(header()).toHaveAttribute('data-stage', 'true');
      const heading = within(header()).getByRole('heading', { level: 1 });
      expect(heading).toHaveAccessibleName('Etapa 1: Título 1');
      expect(heading).toBeVisible();
      expect(heading).not.toHaveClass('visually-hidden');
      const hud = within(header()).getByRole('region', { name: 'Situação do projeto' });
      expect(hud).toHaveClass('hud--compact');
      expect(
        within(header())
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual([
        'Voltar para a lista de etapas',
        'Ajuda: Situação do projeto',
        'Enunciado',
        'Menu',
      ]);
      // Nothing of the stage head is left in the stage itself.
      expect(stage().querySelector('h1, .hud')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toHaveFocus();
    });

    it('opens the briefing from its button', async () => {
      const user = await openStage(1);
      await user.click(screen.getByRole('button', { name: 'Enunciado' }));
      const briefing = screen.getByRole('dialog', { name: 'Etapa 1: Título 1' });
      await user.click(within(briefing).getByRole('button', { name: 'Continuar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // A browser gives the focus back to the button. jsdom leaves it nowhere, which is the
      // case the stage covers by focusing its heading.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
    });

    it('puts the stage actions in the same menu: formula and reset', async () => {
      const user = await openStage(1);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      const menuButton = screen.getByRole('button', { name: 'Menu' });

      await user.click(menuButton);
      const menu = screen.getByRole('menu', { name: 'Menu' });
      expect(
        [...menu.querySelectorAll('[role^="menuitem"]')].map((item) => item.textContent),
      ).toEqual([
        'Hazen-Williams',
        'Darcy-Weisbach',
        'Restaurar diâmetros',
        'Como jogar',
        'Glossário',
        'Português',
        'English',
        'Sistema',
        'Claro',
        'Escuro',
        'Sobre',
      ]);
      const formula = within(menu).getByRole('group', { name: 'Fórmula de perda de carga' });
      expect(
        within(formula).getByRole('menuitemradio', { name: 'Hazen-Williams' }),
      ).toHaveAttribute('aria-checked', 'true');
      await user.click(within(formula).getByRole('menuitemradio', { name: 'Darcy-Weisbach' }));
      expect(useAppStore.getState().formula).toBe('darcy-weisbach');
      expect(useAppStore.getState().stale).toBe(true);

      act(() => useAppStore.getState().setDiameter('T1', 100));
      await user.click(menuButton);
      await user.click(screen.getByRole('menuitem', { name: 'Restaurar diâmetros' }));
      expect(useAppStore.getState().diameters).toEqual({ T1: 50 });
    });
  });

  describe('layout', () => {
    it('is a fixed frame only while a stage is open', async () => {
      const user = await openStage(1);
      expect(document.querySelector('.app')).toHaveClass('app--shell');
      expect(screen.getByRole('main')).toHaveClass('app__main--shell');
      expect(stage()).toHaveClass('stage--frame', 'stage--phone');
      expect(stage()).not.toHaveClass('stage--side');
      expect(stage()).not.toHaveClass('stage--tablet');
      expect(document.querySelector('.stage__bar')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
      expect(document.querySelector('.app')).not.toHaveClass('app--shell');
    });

    it('sets the half height of the sheet in one CSS variable', async () => {
      await openStage(1);
      expect(stage().style.getPropertyValue('--sheet-half-fraction')).toBe(
        String(SHEET_HALF.phone),
      );
      // Under 40 % of the viewport, so the map keeps at least 40 % above the open sheet.
      expect(SHEET_HALF.phone).toBeLessThan(0.4);
    });

    it('focuses the visible stage heading when a stage opens again', async () => {
      const user = await openStage(1);
      await user.click(screen.getByRole('button', { name: 'Voltar para a lista de etapas' }));
      await user.click(screen.getByRole('button', { name: /Etapa 1: / }));
      await user.click(await screen.findByRole('button', { name: 'Continuar' }));
      const heading = screen.getByRole('heading', { level: 1, name: 'Etapa 1: Título 1' });
      expect(heading).toHaveAttribute('tabindex', '-1');
      await waitFor(() => expect(heading).toHaveFocus());
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

    it('explains the HUD and lists the objectives in a help dialog', async () => {
      const user = await openStage(1);
      expect(screen.queryByText('Objetivo 1')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Ajuda: Situação do projeto' }));
      const dialog = screen.getByRole('dialog', { name: 'Situação do projeto' });
      expect(within(dialog).getByText('Objetivo 1')).toBeInTheDocument();
      expect(dialog).toHaveTextContent('Casas em nós sem falha de pressão');
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

  describe('Calcular / Verificar', () => {
    it('sits in the bar of the sheet, shows the stale state and verifies', async () => {
      const user = await openStage(1);
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(within(sheet).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();

      act(() => useAppStore.getState().setDiameter('T1', 100));
      const again = within(sheet).getByRole('button', { name: 'Recalcular' });
      expect(screen.getByText('Resultado desatualizado: recalcule.')).toBeInTheDocument();

      vi.mocked(evaluateInWorker).mockClear();
      await user.click(again);
      expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 100 }, 'hazen-williams');
      expect(
        await within(sheet).findByRole('button', { name: 'Calcular / Verificar' }),
      ).toBeEnabled();
      expect(screen.queryByText('Resultado desatualizado: recalcule.')).not.toBeInTheDocument();
    });
  });

  describe('diameter of the selected pipe', () => {
    it('is text in the sheet; "Alterar" closes the sheet and goes to the bar under the map', async () => {
      const user = await openStage(1);
      // The bar belongs to the map views; a stand-in with the agreed id.
      const bar = document.createElement('div');
      bar.id = 'dn-bar';
      bar.innerHTML = '<button aria-pressed="true">50</button><button>75</button>';
      document.body.append(bar);

      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(sheet).toHaveAttribute('data-detent', 'half');
      expect(within(sheet).getByRole('heading', { name: 'Trecho T1' })).toBeInTheDocument();
      expect(within(sheet).queryByRole('group', { name: /Diâmetro nominal/ })).toBeNull();
      expect(sheet.querySelector('[data-result="dn"]')).toHaveTextContent(/^DN \d+ · R\$\s\d+\/m$/);

      await user.click(
        within(sheet).getByRole('button', { name: 'Alterar o diâmetro do trecho T1' }),
      );
      expect(sheet).toHaveAttribute('data-detent', 'peek');
      expect(bar.querySelector('[aria-pressed="true"]')).toHaveFocus();
      document.body.removeChild(bar);
    });
  });

  describe('held sideways', () => {
    it('shows the panel beside the view, always open', async () => {
      media.set(SIDEWAYS);
      await openStage(1);
      expect(stage()).toHaveClass('stage--frame', 'stage--phone', 'stage--side');
      const panel = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(panel).not.toHaveAttribute('data-detent');
      expect(within(panel).getByRole('group', { name: 'Seção do painel' })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();
    });
  });

  it('goes back to the desktop layout when the viewport grows', async () => {
    await openStage(1);
    act(() => media.set(() => false));
    expect(stage()).not.toHaveClass('stage--frame');
    expect(document.querySelector('.app')).not.toHaveClass('app--shell');
    expect(document.querySelector('.stage__side')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Fórmula de perda de carga' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar diâmetros' })).toBeInTheDocument();
    // The name stays in the header on every device; the HUD moves to the bar of the stage.
    expect(within(header()).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(stage()).getByRole('region', { name: 'Situação do projeto' })).not.toHaveClass(
      'hud--compact',
    );
  });
});

describe('stage screen on a tablet', () => {
  describe('portrait', () => {
    setUp(TABLET_PORTRAIT);

    it('is a frame with the map on top and the panels in the bottom sheet', async () => {
      await openStage(1);
      expect(document.querySelector('.app')).toHaveClass('app--shell');
      expect(stage()).toHaveClass('stage--frame', 'stage--tablet');
      expect(stage()).not.toHaveClass('stage--phone');
      expect(stage()).not.toHaveClass('stage--side');
      expect(stage().style.getPropertyValue('--sheet-half-fraction')).toBe(
        String(SHEET_HALF.tablet),
      );
      expect(document.querySelector('.stage__side')).toBeNull();
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(sheet).toHaveAttribute('data-detent', 'peek');
      expect(within(sheet).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();
    });

    it('keeps the logo and the full HUD, with formula and reset in the menu', async () => {
      const user = await openStage(1);
      expect(screen.getByRole('button', { name: 'Aquatubos, tela inicial' })).toBeInTheDocument();
      expect(within(header()).getByRole('heading', { level: 1 })).toHaveAccessibleName(
        'Etapa 1: Título 1',
      );
      const hud = within(stage()).getByRole('region', { name: 'Situação do projeto' });
      expect(hud).not.toHaveClass('hud--compact');
      expect(within(hud).getByRole('button', { name: 'Ajuda: Estrelas' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByRole('menuitem', { name: 'Restaurar diâmetros' })).toBeInTheDocument();
    });

    it('keeps the full diameter picker in the calculation panel', async () => {
      await openStage(1);
      act(() => useAppStore.getState().select({ type: 'pipe', id: 'T1' }));
      const sheet = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(
        within(sheet).getByRole('group', { name: 'Diâmetro nominal do trecho T1' }),
      ).toBeInTheDocument();
      expect(within(sheet).queryByRole('button', { name: /Alterar/ })).toBeNull();
    });
  });

  describe('landscape', () => {
    setUp(TABLET_LANDSCAPE);

    it('is a frame with the map on the left and the panel on the right, always open', async () => {
      await openStage(1);
      expect(document.querySelector('.app')).toHaveClass('app--shell');
      expect(stage()).toHaveClass('stage--frame', 'stage--tablet', 'stage--side');
      const panel = screen.getByRole('region', { name: 'Cálculo e verificações' });
      expect(panel).toHaveClass('sheet--side');
      expect(panel).not.toHaveAttribute('data-detent');
      expect(within(panel).getByRole('button', { name: 'Calcular / Verificar' })).toBeEnabled();
    });
  });
});
