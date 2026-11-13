import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { makeEvaluation, makeProgress } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { evaluateInWorker } from '../../worker/client';
import { PHONE_LANDSCAPE_QUERY, PHONE_QUERY } from '../shell/breakpoints';
import { ROAD_DY, rowLayout, stripLayout, wideLayout } from './mapLayout';
import { StageSelect } from './StageSelect';
import { shortTitle, STAGE_SHORT_TITLES } from './strings';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const details = () => within(screen.getByTestId('stage-details'));
/** The stage buttons, without the back button of the screen header. */
const stageButtons = () =>
  within(screen.getByRole('list'))
    .getAllByRole('button')
    .filter((button) => button.classList.contains('stage-pin'));

describe('StageSelect', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(evaluateInWorker).mockImplementation(async (id) => makeEvaluation(id));
  });

  it('keeps the heading and moves the intro behind a "?"', async () => {
    const user = userEvent.setup();
    render(<StageSelect />);
    expect(screen.getByRole('heading', { level: 1, name: 'Etapas' })).toBeInTheDocument();
    expect(screen.queryByText(/Concluir uma etapa libera a seguinte/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajuda: Como funciona' }));
    expect(screen.getByRole('note')).toHaveTextContent(/Concluir uma etapa libera a seguinte/);
  });

  it('shows only number, name and status icons on a card', () => {
    useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    const visible = (button: HTMLElement) => {
      const copy = button.cloneNode(true) as HTMLElement;
      for (const hidden of copy.querySelectorAll('.visually-hidden')) hidden.remove();
      return copy.textContent;
    };
    expect(stageButtons().map(visible)).toEqual(['1Título 1 ', '2Título 2Próxima ', '3Título 3']);
    expect(screen.queryByText(/Melhor custo/)).not.toBeInTheDocument();
    // Each status has an icon and a word for screen readers.
    for (const button of stageButtons()) {
      const status = button.querySelector('.stage-pin__status')!;
      expect(status.querySelector('.visually-hidden')).toHaveTextContent(
        /^(Concluída|Não iniciada|Bloqueada)$/,
      );
    }
    expect(stageButtons()[0]!.querySelector('.stage-pin__status svg')).toBeInTheDocument();
    expect(stageButtons()[2]!.querySelector('.stage-pin__status svg')).toBeInTheDocument();
  });

  it('puts a "?" beside each card, never inside the button', () => {
    render(<StageSelect />);
    for (const title of ['Título 1', 'Título 2', 'Título 3']) {
      const help = screen.getByRole('button', { name: `Ajuda: ${title}` });
      expect(help.closest('.stage-pin')).toBeNull();
      expect(help.closest('.stage-card')!.querySelector('.stage-pin')).toBeInTheDocument();
      expect(help).toBeEnabled();
    }
  });

  it('gives summary, status and best cost in the "?" of a card', async () => {
    useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: 'Ajuda: Título 1' }));
    const first = screen.getByRole('note', { name: 'Ajuda: Título 1' });
    expect(first).toHaveTextContent('Concluída');
    expect(first).toHaveTextContent('Resumo 1');
    expect(first).toHaveTextContent('Melhor custo: R$ 12.345,67');

    await user.click(screen.getByRole('button', { name: 'Ajuda: Título 3' }));
    const third = screen.getByRole('note', { name: 'Ajuda: Título 3' });
    expect(third).toHaveTextContent('Bloqueada');
    expect(third).toHaveTextContent('Resumo 3');
    expect(third).toHaveTextContent('Conclua a etapa 2 para liberar.');
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('has one button per stage, in play order, with number and title', () => {
    render(<StageSelect />);
    const buttons = stageButtons();
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Etapa 1: Título 1',
      'Etapa 2: Título 2. Bloqueada: conclua a etapa 1 para liberar.',
      'Etapa 3: Título 3. Bloqueada: conclua a etapa 2 para liberar.',
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('1Título 1');
    expect(buttons[2]).toHaveTextContent('3Título 3');
  });

  it('unlocks only the first stage when there is no progress', () => {
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /^Etapa 1: Título 1/ });
    expect(first).toBeEnabled();
    expect(first).toHaveTextContent('Não iniciada');
    const second = screen.getByRole('button', { name: /^Etapa 2: .*Bloqueada/ });
    expect(second).toBeDisabled();
    expect(second).toHaveTextContent('Bloqueada');
    expect(second.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('describes an unlocked stage with its status and summary', () => {
    render(<StageSelect />);
    expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveAccessibleDescription(
      'Não iniciada. Resumo 1. Próxima etapa a jogar',
    );
  });

  describe('screen header', () => {
    it('goes back to the title screen', async () => {
      useAppStore.setState({ screen: 'map' });
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.click(screen.getByRole('button', { name: 'Início' }));
      expect(useAppStore.getState().screen).toBe('home');
    });

    it('shows the total of stars out of three per stage', () => {
      render(<StageSelect />);
      expect(screen.getByTestId('stages-total')).toHaveTextContent('Estrelas: 0 / 9');

      act(() =>
        useAppStore.setState({
          progress: {
            'stage-1': makeProgress('stage-1', { stars: 3 }),
            'stage-2': makeProgress('stage-2', { stars: 1 }),
          },
        }),
      );
      expect(screen.getByTestId('stages-total')).toHaveTextContent('Estrelas: 4 / 9');
    });

    it('has a heading that can receive focus', () => {
      render(<StageSelect />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('next stage marker', () => {
    it('marks the first stage when there is no progress', () => {
      const { container } = render(<StageSelect />);
      const first = screen.getByRole('button', { name: /^Etapa 1: / });
      expect(first).toHaveClass('stage-pin--next');
      expect(within(first).getByText('Próxima')).toBeInTheDocument();
      expect(screen.getAllByText('Próxima')).toHaveLength(1);
      expect(container.querySelectorAll('.m-pulse')).toHaveLength(1);
    });

    it('moves to the first stage that is not completed', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSelect />);
      expect(screen.getByRole('button', { name: /^Etapa 1: / })).not.toHaveClass('stage-pin--next');
      const second = screen.getByRole('button', { name: /^Etapa 2: / });
      expect(second).toHaveClass('stage-pin--next');
      expect(second).toHaveAccessibleDescription('Não iniciada. Resumo 2. Próxima etapa a jogar');
    });

    it('is absent when every stage is completed', () => {
      useAppStore.setState({
        progress: {
          'stage-1': makeProgress('stage-1'),
          'stage-2': makeProgress('stage-2'),
          'stage-3': makeProgress('stage-3'),
        },
      });
      const { container } = render(<StageSelect />);
      expect(screen.queryByText('Próxima')).not.toBeInTheDocument();
      expect(container.querySelector('.m-pulse')).not.toBeInTheDocument();
      expect(screen.getAllByText('Concluída')).toHaveLength(3);
    });
  });

  it('numbers the waypoints of the map', () => {
    const { container } = render(<StageSelect />);
    expect([...container.querySelectorAll('.m-number')].map((n) => n.textContent)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('shows a stage with a saved design as in progress', () => {
    useAppStore.setState({
      progress: {
        'stage-1': makeProgress('stage-1', { completed: false, stars: 0, bestCost: null }),
      },
    });
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /^Etapa 1: / });
    expect(first).toHaveTextContent('Em andamento');
    expect(within(first).queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Etapa 2: Título 2/ })).toBeDisabled();
  });

  it('shows stars and best cost of a completed stage and unlocks the next one', () => {
    useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    const first = screen.getByRole('button', { name: /Etapa 1: Título 1/ });
    expect(first).toHaveTextContent('Concluída');
    expect(first).not.toHaveTextContent('Melhor custo');
    expect(within(first).getByRole('img', { name: '2 de 3 estrelas' })).toBeInTheDocument();
    expect(screen.getAllByText('Concluída')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Etapa 2: Título 2/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Etapa 3: Título 3/ })).toBeDisabled();
  });

  it('fills the main with water up to the last unlocked stage', () => {
    const { container } = render(<StageSelect />);
    expect(container.querySelectorAll('.m-main--dry')).toHaveLength(2);
    expect(container.querySelectorAll('.m-site--locked')).toHaveLength(2);

    act(() => useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } }));
    expect(container.querySelectorAll('.stage-map__art > .m-main--wet')).toHaveLength(1);
    expect(container.querySelectorAll('.m-main--dry')).toHaveLength(1);
    expect(container.querySelectorAll('.m-site--locked')).toHaveLength(1);
  });

  it('opens an unlocked stage on click', async () => {
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 1: Título 1/ }));
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-1'));
    expect(evaluateInWorker).toHaveBeenCalledWith('stage-1', { T1: 50 }, 'hazen-williams');
  });

  it('opens a stage with the keyboard, in tab order', async () => {
    const openStage = vi.fn(async () => undefined);
    useAppStore.setState({
      openStage,
      progress: { 'stage-1': makeProgress('stage-1') },
    });
    const user = userEvent.setup();
    render(<StageSelect />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Início' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ajuda: Como funciona' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ajuda: Título 1' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Etapa 2: / })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(openStage).toHaveBeenLastCalledWith('stage-2');
    await user.keyboard(' ');
    expect(openStage).toHaveBeenCalledTimes(2);
  });

  it('does not open a locked stage', async () => {
    const user = userEvent.setup();
    const { container } = render(<StageSelect />);
    await user.click(screen.getByRole('button', { name: /Etapa 2: Título 2/ }));
    await user.click(container.querySelectorAll('.m-hit')[1]!);
    expect(useAppStore.getState().scenario).toBeNull();
  });

  it('opens an unlocked stage from its scenery', async () => {
    const user = userEvent.setup();
    const { container } = render(<StageSelect />);
    await user.click(container.querySelectorAll('.m-hit')[0]!);
    await waitFor(() => expect(useAppStore.getState().scenario?.id).toBe('stage-1'));
  });

  describe('details area', () => {
    it('starts on the furthest unlocked stage', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSelect />);
      expect(details().getByText('Etapa 2: Título 2')).toBeInTheDocument();
      expect(details().getByText('Resumo 2')).toBeInTheDocument();
    });

    it('follows the focused stage', async () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.tab();
      await user.tab();
      await user.tab();
      expect(details().getByText('Etapa 1: Título 1')).toBeInTheDocument();
      expect(details().getByText(/Melhor custo/)).toHaveTextContent('Melhor custo: R$ 12.345,67');
      expect(details().queryByText('Concluída')).not.toBeInTheDocument();
      expect(details().getByText('Resumo 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Etapa 1: / })).toHaveClass('stage-pin--active');
    });

    it('shows a locked stage under the pointer with the way to unlock it', async () => {
      const user = userEvent.setup();
      render(<StageSelect />);
      await user.hover(screen.getByRole('button', { name: /^Etapa 3: / }).closest('li')!);
      expect(details().getByText('Resumo 3')).toBeInTheDocument();
      expect(details().getByText('Conclua a etapa 2 para liberar.')).toBeInTheDocument();
    });
  });

  it('follows the language', () => {
    useAppStore.setState({ lang: 'en', progress: { 'stage-1': makeProgress('stage-1') } });
    render(<StageSelect />);
    expect(screen.getByRole('heading', { level: 1, name: 'Stages' })).toBeInTheDocument();
    const first = screen.getByRole('button', { name: 'Stage 1: Title 1' });
    expect(first).toHaveTextContent('Completed');
    expect(screen.getByRole('button', { name: 'Help: How it works' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help: Title 1' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Stage 3: Title 3. Locked: complete stage 2 to unlock.' }),
    ).toBeDisabled();
  });

  /** Makes exactly the given media queries match. */
  const stubMedia = (...matching: string[]) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  const LABELS = [
    'Etapa 1: Título 1',
    'Etapa 2: Título 2. Bloqueada: conclua a etapa 1 para liberar.',
    'Etapa 3: Título 3. Bloqueada: conclua a etapa 2 para liberar.',
  ];

  describe('on a phone', () => {
    beforeEach(() => stubMedia(PHONE_QUERY, '(pointer: coarse)'));
    afterEach(() => vi.unstubAllGlobals());

    it('draws one strip per stage with the same buttons', () => {
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stages')).toHaveClass('stages--tall');
      expect(container.querySelector('.stage-map')).toHaveClass('stage-map--tall');
      const strips = container.querySelectorAll('.stage-map__art');
      expect(strips).toHaveLength(3);
      for (const strip of strips) expect(strip).toHaveAttribute('viewBox', '0 0 360 140');
      expect(stageButtons().map((button) => button.getAttribute('aria-label'))).toEqual(LABELS);
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('keeps the summary out of the card: it is the description and the "?"', async () => {
      const user = userEvent.setup();
      render(<StageSelect />);
      const first = screen.getByRole('button', { name: /^Etapa 1: / });
      expect(within(first).getByText('Resumo 1')).toHaveClass('visually-hidden');
      expect(first).toHaveAccessibleDescription('Não iniciada. Resumo 1. Próxima etapa a jogar');
      expect(screen.queryByTestId('stage-details')).not.toBeInTheDocument();
      // On a phone the help is a dialog.
      await user.click(screen.getByRole('button', { name: 'Ajuda: Título 3' }));
      const help = screen.getByRole('dialog', { name: 'Título 3' });
      expect(help).toHaveTextContent('Resumo 3');
      expect(help).toHaveTextContent('Conclua a etapa 2 para liberar.');
    });

    it('opens a stage with one activation of its card or of its drawing', async () => {
      const openStage = vi.fn(async () => undefined);
      useAppStore.setState({ openStage, progress: { 'stage-1': makeProgress('stage-1') } });
      const user = userEvent.setup();
      const { container } = render(<StageSelect />);
      await user.click(screen.getByRole('button', { name: /^Etapa 2: / }));
      expect(openStage).toHaveBeenLastCalledWith('stage-2');
      await user.click(container.querySelectorAll('.m-hit')[0]!);
      expect(openStage).toHaveBeenLastCalledWith('stage-1');
      await user.click(container.querySelectorAll('.m-hit')[2]!);
      expect(openStage).toHaveBeenCalledTimes(2);
    });

    it('fills the main with water up to the last unlocked stage', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      const { container } = render(<StageSelect />);
      const rows = [...container.querySelectorAll('.stage-map__row')];
      // Road out of 1 and into 2 are wet; out of 2 and into 3 are dry.
      expect(rows.map((row) => row.querySelectorAll('.m-main--wet').length)).toEqual([1, 1, 0]);
      expect(rows.map((row) => row.querySelectorAll('.m-main--dry').length)).toEqual([0, 1, 1]);
      expect(container.querySelectorAll('.m-site--locked')).toHaveLength(1);
      expect(container.querySelectorAll('.m-pulse')).toHaveLength(1);
      expect(rows[1]!.querySelector('.m-pulse')).toBeInTheDocument();
    });
  });

  describe('on a phone held sideways', () => {
    beforeEach(() => stubMedia(PHONE_QUERY, PHONE_LANDSCAPE_QUERY, '(pointer: coarse)'));
    afterEach(() => vi.unstubAllGlobals());

    it('lays the neighbourhoods out in one low row with the cards under it', () => {
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stages')).toHaveClass('stages--row');
      const map = container.querySelector<HTMLElement>('.stage-map')!;
      expect(map).toHaveClass('stage-map--row');
      // In flow, so the drawing gives the height: no aspect ratio of the wide map.
      expect(map.style.aspectRatio).toBe('');
      expect(container.querySelectorAll('.stage-map__art')).toHaveLength(1);
      expect(container.querySelector('.stage-map__art')).toHaveAttribute('viewBox', '0 0 1000 150');
      for (const item of container.querySelectorAll<HTMLElement>('.stage-map__item')) {
        expect(item.getAttribute('style')).toBeNull();
      }
      expect(stageButtons().map((button) => button.getAttribute('aria-label'))).toEqual(LABELS);
      expect(screen.queryByTestId('stage-details')).not.toBeInTheDocument();
      expect(container.querySelector('.m-halo')).not.toBeInTheDocument();
    });

    it('opens a stage from its card or from its drawing', async () => {
      const openStage = vi.fn(async () => undefined);
      useAppStore.setState({ openStage });
      const user = userEvent.setup();
      const { container } = render(<StageSelect />);
      await user.click(screen.getByRole('button', { name: /^Etapa 1: / }));
      await user.click(container.querySelectorAll('.m-hit')[0]!);
      await user.click(container.querySelectorAll('.m-hit')[1]!);
      expect(openStage).toHaveBeenCalledTimes(2);
    });
  });

  describe('on a wide touch screen', () => {
    beforeEach(() => stubMedia('(pointer: coarse)'));
    afterEach(() => vi.unstubAllGlobals());

    it('keeps the wide map; the "?" of each card replaces the details area', () => {
      const { container } = render(<StageSelect />);
      expect(container.querySelector('.stages')).toHaveClass('stages--wide');
      expect(container.querySelector('.stage-map')).toHaveClass('stage-map--wide');
      expect(screen.queryByTestId('stage-details')).not.toBeInTheDocument();
      expect(stageButtons()).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: /^Ajuda: Título/ })).toHaveLength(3);
    });
  });

  describe('contracts of the end-to-end tests', () => {
    it('keeps the names, the back button and the total', () => {
      useAppStore.setState({ progress: { 'stage-1': makeProgress('stage-1') } });
      render(<StageSelect />);
      expect(screen.getByRole('heading', { name: 'Etapas' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Início' })).toBeInTheDocument();
      expect(screen.getByTestId('stages-total')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Etapa 1: Título 1/ })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^Etapa 3: .*Bloqueada/ })).toBeDisabled();
      // One element per completed stage, also while a help that says the same is closed.
      const done = screen.getAllByText('Concluída');
      expect(done).toHaveLength(1);
      for (const element of done) expect(element).toHaveClass('visually-hidden');
    });
  });
});

describe('short names', () => {
  it('has a name of one to three words for each real stage, in both languages', () => {
    expect(Object.keys(STAGE_SHORT_TITLES)).toEqual([
      'stage1',
      'stage2',
      'stage3',
      'stage4',
      'stage5',
    ]);
    for (const name of Object.values(STAGE_SHORT_TITLES)) {
      for (const text of [name.pt, name.en]) {
        expect(text.split(' ').length).toBeLessThanOrEqual(3);
      }
    }
    const title = { pt: 'Rede malhada (um anel)', en: 'Looped network (one ring)' };
    expect(shortTitle({ id: 'stage3', title })).toEqual({ pt: 'Um anel', en: 'One ring' });
  });

  it('falls back to the full title for an unknown stage', () => {
    const title = { pt: 'Etapa nova', en: 'New stage' };
    expect(shortTitle({ id: 'stage-9', title })).toBe(title);
  });
});

describe('map layouts', () => {
  it('spreads the stages left to right on the wide map', () => {
    const { sites, width } = wideLayout(5);
    const xs = sites.map((site) => site.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[0]).toBeGreaterThanOrEqual(150);
    expect(xs[4]).toBeLessThanOrEqual(width - 150);
  });

  it('keeps the row of the sideways phone low, with every neighbourhood inside it', () => {
    const { sites, width, height } = rowLayout(5);
    expect(width / height).toBeGreaterThan(6);
    expect(sites.map((site) => site.x)).toEqual(wideLayout(5).sites.map((site) => site.x));
    for (const site of sites) {
      expect(site.label).toBeUndefined();
      expect(site.y - 60).toBeGreaterThanOrEqual(0);
      expect(site.y + ROAD_DY + 12).toBeLessThanOrEqual(height);
    }
  });

  it('alternates the sides of the strips of the phone map', () => {
    const { strips, width, height } = stripLayout(5);
    expect(strips.map((strip) => strip.x < width / 2)).toEqual([true, false, true, false, true]);
    for (const strip of strips) {
      // The drawing (about 180 × 120 around the centre) and the waypoint stay inside the strip.
      expect(strip.x - 90).toBeGreaterThanOrEqual(0);
      expect(strip.x + 90).toBeLessThanOrEqual(width);
      expect(strip.y - 60).toBeGreaterThanOrEqual(0);
      expect(strip.y + ROAD_DY + 12).toBeLessThanOrEqual(height);
    }
  });

  it('joins the road of the phone map from one strip to the next', () => {
    const { strips, height } = stripLayout(4);
    expect(strips[0]!.roadIn).toBeNull();
    expect(strips[3]!.roadOut).toBeNull();
    for (let i = 0; i < 3; i++) {
      const from = strips[i]!;
      const to = strips[i + 1]!;
      const node = from.y + ROAD_DY;
      // Out: from the waypoint straight down to the bottom edge.
      expect(from.roadOut).toBe(`M${from.x} ${node}V${height}`);
      // In: from the top edge at the same x to the waypoint of the next stage.
      expect(to.roadIn!.startsWith(`M${from.x} 0C`)).toBe(true);
      expect(to.roadIn!.endsWith(` ${to.x} ${to.y + ROAD_DY}`)).toBe(true);
    }
  });

  it('draws a single stage without a road', () => {
    expect(stripLayout(1).strips).toEqual([{ x: 98, y: 62, roadIn: null, roadOut: null }]);
    expect(stripLayout(0).strips).toEqual([]);
  });

  it('keeps the map light', () => {
    vi.mocked(evaluateInWorker).mockReset();
    resetStore();
    const { container } = render(<StageSelect />);
    expect(container.querySelectorAll('svg *').length).toBeLessThan(300);
  });
});
