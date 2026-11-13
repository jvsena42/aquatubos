import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
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

  it('presents the game: name, tagline and what the player learns', () => {
    renderHome();
    const heading = screen.getByRole('heading', { level: 1, name: 'Aquatubos' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('Projete a rede de água da cidade')).toBeInTheDocument();
    expect(screen.getByText(/Hazen-Williams.*Hardy Cross.*NBR 12218/)).toBeInTheDocument();
  });

  it('groups the pitch apart from the actions, so they can sit side by side in landscape', () => {
    const { container } = renderHome({ progress: allCompleted });
    const intro = within(container.querySelector<HTMLElement>('.home__intro')!);
    const menu = within(container.querySelector<HTMLElement>('.home__menu')!);
    expect(intro.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(intro.queryByRole('button')).not.toBeInTheDocument();
    expect(menu.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Mapa de etapasTodas as etapas concluídas',
      'Como jogar',
      'Glossário',
      'Sobre',
    ]);
    expect(menu.getByRole('group', { name: 'Seu progresso' })).toBeInTheDocument();
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

    it('shows a quiet note instead of the totals', () => {
      renderHome();
      expect(screen.getByText(/Nenhuma etapa concluída ainda/)).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Seu progresso' })).not.toBeInTheDocument();
    });

    it('puts the main action first in the tab order', async () => {
      const { user } = renderHome();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Jogar' })).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(goToMap).toHaveBeenCalledTimes(1);
      await user.tab();
      expect(screen.getByRole('button', { name: 'Como jogar' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Glossário' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Sobre' })).toHaveFocus();
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
      const totals = within(screen.getByRole('group', { name: 'Seu progresso' }));
      expect(totals.getByText('Estrelas').nextElementSibling).toHaveTextContent('0 / 9');
      expect(totals.getByText('Etapas concluídas').nextElementSibling).toHaveTextContent('0 / 3');
      expect(totals.queryByText(/Melhor custo somado/)).not.toBeInTheDocument();
    });
  });

  describe('with stages 1 and 2 completed', () => {
    const progress = {
      'stage-1': makeProgress('stage-1', { stars: 3, bestCost: 1000 }),
      'stage-2': makeProgress('stage-2', { stars: 2, bestCost: 2000.5 }),
    };

    it('continues on stage 3 and also offers the stage map', async () => {
      const { user } = renderHome({ progress });
      await user.click(screen.getByRole('button', { name: 'Continuar: Etapa 3: Título 3' }));
      expect(openStage).toHaveBeenCalledWith('stage-3');
      await user.click(screen.getByRole('button', { name: 'Mapa de etapas' }));
      expect(goToMap).toHaveBeenCalledTimes(1);
    });

    it('shows stars, stages completed and the best cost with the stages it covers', () => {
      renderHome({ progress });
      const totals = within(screen.getByRole('group', { name: 'Seu progresso' }));
      expect(totals.getByText('Estrelas').nextElementSibling).toHaveTextContent('5 / 9');
      expect(totals.getByText('Etapas concluídas').nextElementSibling).toHaveTextContent('2 / 3');
      expect(
        totals.getByText('Melhor custo somado (2 etapas)').nextElementSibling,
      ).toHaveTextContent('R$ 3.000,50');
      expect(screen.queryByText(/Nenhuma etapa concluída ainda/)).not.toBeInTheDocument();
    });
  });

  describe('with every stage completed', () => {
    it('says so and sends the main action to the stage map', async () => {
      const { user } = renderHome({ progress: allCompleted });
      expect(screen.queryByRole('button', { name: /Continuar/ })).not.toBeInTheDocument();
      const buttons = screen.getAllByRole('button', { name: /Mapa de etapas/ });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Mapa de etapas: Todas as etapas concluídas');
      await user.click(buttons[0]!);
      expect(goToMap).toHaveBeenCalledTimes(1);
      expect(openStage).not.toHaveBeenCalled();
    });

    it('adds up every stage', () => {
      renderHome({ progress: allCompleted });
      const totals = within(screen.getByRole('group', { name: 'Seu progresso' }));
      expect(totals.getByText('Estrelas').nextElementSibling).toHaveTextContent('6 / 9');
      expect(
        totals.getByText('Melhor custo somado (3 etapas)').nextElementSibling,
      ).toHaveTextContent('R$ 6.000,50');
    });
  });

  it('follows the language', async () => {
    const { user } = renderHome({
      lang: 'en',
      progress: { 'stage-1': makeProgress('stage-1', { bestCost: 1234.5 }) },
    });
    expect(screen.getByText("Design the town's water network")).toBeInTheDocument();
    expect(screen.getByText(/Learn to size water distribution networks/)).toBeInTheDocument();
    for (const name of ['Stage map', 'How to play', 'Glossary', 'About']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    const totals = within(screen.getByRole('group', { name: 'Your progress' }));
    expect(totals.getByText('Best total cost (1 stage)').nextElementSibling).toHaveTextContent(
      'R$ 1,234.50',
    );
    await user.click(screen.getByRole('button', { name: 'Continue: Stage 2: Title 2' }));
    expect(openStage).toHaveBeenCalledWith('stage-2');
  });

  it('switches text when the language changes', () => {
    renderHome();
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
    act(() => useAppStore.getState().setLang('en'));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText(/No stages completed yet/)).toBeInTheDocument();
  });
});
