import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { fixtureScenarios, makeProgress, makeScenario } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { PHONE_LANDSCAPE_QUERY, PHONE_QUERY } from '../shell/breakpoints';
import { HomeScreen } from './HomeScreen';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const goToMap = vi.fn();
const openStage = vi.fn(async () => undefined);

function renderHome(state: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  useAppStore.setState({ goToMap, openStage, ...state });
  const user = userEvent.setup();
  const view = render(<HomeScreen />);
  return { user, ...view };
}

/** Text of each progress chip, hidden labels included. */
const chips = (group = 'Seu progresso') =>
  [...screen.getByRole('group', { name: group }).children].map((chip) => chip.textContent);

const original = [...fixtureScenarios];

const allCompleted = {
  'stage-1': makeProgress('stage-1', { stars: 3, bestCost: 1000 }),
  'stage-2': makeProgress('stage-2', { stars: 2, bestCost: 2000 }),
  'stage-3': makeProgress('stage-3', { stars: 1, bestCost: 3000.5 }),
};

describe('HomeScreen', () => {
  beforeEach(() => {
    resetStore();
    goToMap.mockClear();
    openStage.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('presents the game with its name and tagline only', () => {
    renderHome();
    const heading = screen.getByRole('heading', { level: 1, name: 'Aquatubos' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('Projete a rede de água da cidade')).toBeInTheDocument();
    // Sentences are behind the "?".
    expect(screen.queryByText(/Hazen-Williams/)).not.toBeInTheDocument();
    expect(screen.queryByText(/salvo neste dispositivo/)).not.toBeInTheDocument();
  });

  it('explains what the app is behind the "?" next to the tagline', async () => {
    const { user } = renderHome();
    await user.click(screen.getByRole('button', { name: 'Ajuda: O que é o Aquatubos' }));
    const help = screen.getByRole('note', { name: 'Ajuda: O que é o Aquatubos' });
    expect(help).toHaveTextContent(/Hazen-Williams.*Hardy Cross.*NBR 12218/);
    expect(help).toHaveTextContent('O progresso fica salvo neste dispositivo.');
  });

  it('has one button besides the help: no secondary buttons and no dialogs of its own', () => {
    renderHome();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '?',
      'Jogar',
    ]);
    for (const name of ['Como jogar', 'Glossário', 'Sobre']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(document.querySelector('dialog')).not.toBeInTheDocument();
  });

  it('groups the name apart from the action, so they can sit side by side in landscape', () => {
    const { container } = renderHome({ progress: allCompleted });
    const intro = within(container.querySelector<HTMLElement>('.home__intro')!);
    const menu = within(container.querySelector<HTMLElement>('.home__menu')!);
    expect(intro.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(menu.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Mapa de etapas',
    ]);
    expect(menu.getByRole('group', { name: 'Seu progresso' })).toBeInTheDocument();
  });

  it('uses the side-by-side layout only on a phone held sideways', () => {
    const { container, unmount } = renderHome();
    expect(container.querySelector('.home')).not.toHaveClass('home--landscape');
    unmount();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === PHONE_LANDSCAPE_QUERY || query === PHONE_QUERY,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const sideways = renderHome();
    expect(sideways.container.querySelector('.home')).toHaveClass('home--landscape');
  });

  it('draws a decorative scene that stays light', () => {
    const { container } = renderHome();
    const scene = container.querySelector('.home-scene')!;
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    expect(scene.querySelectorAll('.hs-flow').length).toBeGreaterThan(0);
    expect(scene.querySelectorAll('.hs-lit')).toHaveLength(8);
    expect(scene.querySelectorAll('*').length).toBeLessThan(250);
  });

  describe('without progress', () => {
    it('offers to play and goes to the stage map', async () => {
      const { user } = renderHome();
      expect(screen.queryByRole('button', { name: /Continuar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mapa de etapas' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Jogar' }));
      expect(goToMap).toHaveBeenCalledTimes(1);
      expect(openStage).not.toHaveBeenCalled();
    });

    it('shows no totals and no sentence in their place', () => {
      const { container } = renderHome();
      expect(screen.queryByRole('group', { name: 'Seu progresso' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Nenhuma etapa/)).not.toBeInTheDocument();
      expect(container.querySelector('.home__menu')).toHaveTextContent(/^Jogar$/);
    });

    it('activates the main action with the keyboard', async () => {
      const { user } = renderHome();
      screen.getByRole('button', { name: 'Jogar' }).focus();
      await user.keyboard('{Enter}');
      expect(goToMap).toHaveBeenCalledTimes(1);
    });
  });

  describe('with a saved design only', () => {
    const progress = {
      'stage-1': makeProgress('stage-1', { completed: false, stars: 0, bestCost: null }),
    };

    it('continues on stage 1', async () => {
      const { user } = renderHome({ progress });
      await user.click(screen.getByRole('button', { name: 'Continuar: Etapa 1: Título 1' }));
      expect(openStage).toHaveBeenCalledWith('stage-1');
      expect(goToMap).not.toHaveBeenCalled();
    });

    it('shows zero totals without a cost', () => {
      renderHome({ progress });
      expect(chips()).toEqual(['Estrelas: 0/9', 'Etapas concluídas: 0/3etapas']);
    });
  });

  describe('with stages 1 and 2 completed', () => {
    const progress = {
      'stage-1': makeProgress('stage-1', { stars: 3, bestCost: 1000 }),
      'stage-2': makeProgress('stage-2', { stars: 2, bestCost: 2000.5 }),
    };

    it('continues on stage 3 and keeps the stage map one small link away', async () => {
      const { user } = renderHome({ progress });
      await user.click(screen.getByRole('button', { name: 'Continuar: Etapa 3: Título 3' }));
      expect(openStage).toHaveBeenCalledWith('stage-3');
      const link = screen.getByRole('button', { name: 'Mapa de etapas' });
      expect(link).toHaveClass('home__map-link');
      expect(link).not.toHaveClass('btn');
      await user.click(link);
      expect(goToMap).toHaveBeenCalledTimes(1);
    });

    it('shows stars, stages completed and the best cost as one row of chips', () => {
      renderHome({ progress });
      // The cost is rounded to whole reais; the label of each chip is for screen readers.
      expect(chips()).toEqual([
        'Estrelas: 5/9',
        'Etapas concluídas: 2/3etapas',
        'Melhor custo somado (2 etapas): R$\u00a03.001',
      ]);
      const group = screen.getByRole('group', { name: 'Seu progresso' });
      expect(within(group).getByText('Estrelas:')).toHaveClass('visually-hidden');
      expect(within(group).getByText('etapas')).toHaveAttribute('aria-hidden', 'true');
      expect(within(group).queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('with every stage completed', () => {
    it('sends the main action to the stage map, without a second way there', async () => {
      const { user } = renderHome({ progress: allCompleted });
      expect(screen.queryByRole('button', { name: /Continuar/ })).not.toBeInTheDocument();
      const buttons = screen.getAllByRole('button', { name: /^Mapa de etapas/ });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveClass('home__play');
      await user.click(buttons[0]!);
      expect(goToMap).toHaveBeenCalledTimes(1);
      expect(openStage).not.toHaveBeenCalled();
    });

    it('adds up every stage', () => {
      renderHome({ progress: allCompleted });
      expect(chips()).toEqual([
        'Estrelas: 6/9',
        'Etapas concluídas: 3/3etapas',
        'Melhor custo somado (3 etapas): R$\u00a06.001',
      ]);
    });
  });

  it('names the stage to continue by its short name', async () => {
    const real = [
      makeScenario(1, { id: 'stage1' }),
      makeScenario(2, { id: 'stage2' }),
      makeScenario(3, { id: 'stage3' }),
    ];
    fixtureScenarios.splice(0, 3, ...real);
    try {
      renderHome({ progress: { stage1: makeProgress('stage1'), stage2: makeProgress('stage2') } });
      const play = screen.getByRole('button', { name: 'Continuar: Etapa 3: Um anel' });
      expect(play).toHaveTextContent('ContinuarEtapa 3: Um anel');
    } finally {
      fixtureScenarios.splice(0, 3, ...original);
    }
  });

  it('follows the language', async () => {
    const { user } = renderHome({
      lang: 'en',
      progress: { 'stage-1': makeProgress('stage-1', { bestCost: 1234.5 }) },
    });
    expect(screen.getByText("Design the town's water network")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stage map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help: What is Aquatubos' })).toBeInTheDocument();
    expect(chips('Your progress')).toEqual([
      'Stars: 2/9',
      'Stages completed: 1/3stages',
      'Best total cost (1 stage): R$\u00a01,235',
    ]);
    await user.click(screen.getByRole('button', { name: 'Continue: Stage 2: Title 2' }));
    expect(openStage).toHaveBeenCalledWith('stage-2');
  });

  it('switches text when the language changes', () => {
    renderHome();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
    act(() => useAppStore.getState().setLang('en'));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
