import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { houseCount, housesSummary } from '../../game/houses';
import { getScenario, SCENARIOS } from '../../scenarios';
import type { Diameters, Scenario } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { makeIssue } from '../../test/fixtures';
import { resetStore } from '../../test/store';
import { NetworkView } from '../network/NetworkView';
import { TownView } from './TownView';

vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

/** Opens a real stage with a real evaluation, like the store does after the worker answers. */
function openStage(id: string, diameters?: Diameters) {
  const scenario = stage(id);
  const design = diameters ?? initialDiameters(scenario);
  const evaluation = evaluateStage(scenario, design, scenario.formula);
  useAppStore.setState({ scenario, diameters: design, formula: scenario.formula, evaluation });
  return { scenario, evaluation };
}

const solved = (id: string) => openStage(id, stage(id).reference.diameters);

const element = (type: string, id: string): Element => {
  const found = document.querySelectorAll(`[data-element="${type}"][data-id="${id}"]`);
  if (found.length !== 1) throw new Error(`${found.length} elements for ${type} ${id}`);
  return found[0]!;
};

const root = () => document.querySelector('.town')!;
const ids = () =>
  [...document.querySelectorAll('[data-element]')]
    .map((el) => `${el.getAttribute('data-element')}:${el.getAttribute('data-id')}`)
    .sort();
const worldTransform = () => document.querySelector('.town__world')!.getAttribute('transform')!;

/** What the player does: a new verified result arrives in the store. */
function verify(id: string, diameters?: Diameters) {
  const scenario = stage(id);
  const design = diameters ?? initialDiameters(scenario);
  act(() => {
    useAppStore.setState({
      diameters: design,
      evaluation: evaluateStage(scenario, design, scenario.formula),
      stale: false,
      verifiedAt: Date.now(),
    });
  });
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matches && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('TownView', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders nothing without an open stage', () => {
    const { container } = render(<TownView />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(SCENARIOS.map((scenario) => scenario.id))(
    'draws one street per pipe and the houses of every node of %s',
    (id) => {
      const { scenario } = openStage(id);
      render(<TownView />);
      expect(screen.getByRole('group', { name: 'Mapa da cidade' })).toBeInTheDocument();
      expect(document.querySelectorAll('[data-element="pipe"]')).toHaveLength(
        scenario.pipes.length,
      );
      expect(document.querySelectorAll('[data-element="node"]')).toHaveLength(
        scenario.nodes.length,
      );
      expect(document.querySelectorAll('[data-element="reservoir"]')).toHaveLength(
        scenario.reservoirs.length,
      );
      expect(document.querySelectorAll('[data-element="pump"]')).toHaveLength(
        scenario.pumps.length,
      );
      for (const node of scenario.nodes) {
        const cluster = element('node', node.id);
        expect(cluster.querySelectorAll('.town__house')).toHaveLength(houseCount(node));
      }
      for (const el of document.querySelectorAll('[data-element]')) {
        expect(el).toHaveAttribute('role', 'button');
        expect(el).toHaveAttribute('tabindex', '0');
        expect(el).toHaveAccessibleName();
      }
      // Within the drawing budget, labels and status marks included.
      expect(document.querySelectorAll('.town__svg *').length).toBeLessThan(1500);
    },
  );

  it('uses the same element ids as the schematic', () => {
    for (const scenario of SCENARIOS) {
      openStage(scenario.id);
      const town = render(<TownView />);
      const townIds = ids();
      town.unmount();
      const schematic = render(<NetworkView />);
      expect(townIds).toEqual(ids());
      schematic.unmount();
    }
  });

  it('names pipes, nodes, the reservoir and the pump with their values', () => {
    solved('stage1');
    const view = render(<TownView />);
    expect(element('pipe', 'T2')).toHaveAccessibleName(
      'Trecho T2, DN 75 mm, vazão 6,00 L/s, velocidade 1,36 m/s, escoamento de N1 para N2',
    );
    expect(element('node', 'N3')).toHaveAccessibleName(
      'Nó N3, 8 casas, demanda 2,50 L/s, pressão 12,9 mca, atendido',
    );
    expect(element('reservoir', 'R1')).toHaveAccessibleName(
      "Reservatório R1, nível d'água 125,00 m, reservatório elevado",
    );
    expect(element('reservoir', 'R1')).toHaveAttribute('data-kind', 'elevated');
    view.unmount();

    solved('stage5');
    render(<TownView />);
    expect(element('pump', 'B1')).toHaveAccessibleName(
      /^Bomba B1, vazão 12,00 L\/s, .*casa de bombas$/,
    );
    expect(element('reservoir', 'R1')).toHaveAttribute('data-kind', 'ground');
    // The pump discharge node has no demand: no houses and no service status to report.
    expect(element('node', 'J1')).toHaveAccessibleName(
      /^Nó J1, sem casas, pressão .* mca, pressão não verificada$/,
    );
    expect(element('node', 'J1').querySelector('.town__house')).toBeNull();
  });

  it('selects with a click and clears with a click on the ground', async () => {
    const user = userEvent.setup();
    openStage('stage5');
    render(<TownView />);

    await user.click(element('pipe', 'T2').querySelector('.town__pipe-line')!);
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
    expect(element('pipe', 'T2')).toHaveAttribute('aria-pressed', 'true');
    expect(element('pipe', 'T2')).toHaveClass('town__el--selected');
    expect(element('pipe', 'T1')).toHaveAttribute('aria-pressed', 'false');

    // The street is the target, not only the thin pipe line.
    await user.click(element('pipe', 'T4').querySelector('.town__hit')!);
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T4' });

    await user.click(element('node', 'N3').querySelector('.town__house')!);
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N3' });
    expect(element('node', 'N3')).toHaveClass('town__el--selected');

    await user.click(element('node', 'N5').querySelector('.town__plaza-hit')!);
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N5' });

    // The ground between the houses of a cluster also selects its node.
    await user.click(document.querySelector('[data-node-hit="N6"]')!);
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N6' });

    await user.click(element('reservoir', 'R1'));
    expect(useAppStore.getState().selection).toEqual({ type: 'reservoir', id: 'R1' });

    await user.click(element('pump', 'B1'));
    expect(useAppStore.getState().selection).toEqual({ type: 'pump', id: 'B1' });

    await user.click(document.querySelector('.town__svg')!);
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('selects with Enter and Space and clears with Escape', async () => {
    const user = userEvent.setup();
    openStage('stage1');
    render(<TownView />);

    (element('pipe', 'T1') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T1' });

    (element('node', 'N4') as HTMLElement).focus();
    await user.keyboard(' ');
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N4' });

    await user.keyboard('{Escape}');
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('pans without selecting, zooms with the buttons and fits again', async () => {
    const user = userEvent.setup();
    openStage('stage1');
    render(<TownView />);
    const svg = document.querySelector('.town__svg')!;
    const fitted = worldTransform();

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.click(element('pipe', 'T1'));
    expect(useAppStore.getState().selection).toBeNull();
    expect(worldTransform()).not.toBe(fitted);

    await user.click(screen.getByRole('button', { name: 'Enquadrar a rede' }));
    expect(worldTransform()).toBe(fitted);
    await user.click(screen.getByRole('button', { name: 'Aproximar' }));
    const scaleOf = (transform: string) => Number(/scale\(([\d.]+)\)/.exec(transform)![1]);
    expect(scaleOf(worldTransform())).toBeCloseTo(scaleOf(fitted) * 1.4, 3);
    await user.click(screen.getByRole('button', { name: 'Afastar' }));
    expect(scaleOf(worldTransform())).toBeCloseTo(scaleOf(fitted), 3);
  });

  it('marks the houses of failing and passing nodes with a status, a tint and a badge', () => {
    openStage('stage3');
    const view = render(<TownView />);
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(element('node', id)).toHaveAttribute('data-status', 'low');
      expect(element('node', id)).toHaveAccessibleName(
        /pressão dinâmica abaixo da mínima, torneiras secas$/,
      );
      expect(document.querySelector(`[data-label-for="${id}"] .town__badge--low`)).not.toBeNull();
    }
    view.unmount();

    solved('stage3');
    render(<TownView />);
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(element('node', id)).toHaveAttribute('data-status', 'ok');
      expect(element('node', id)).toHaveAccessibleName(/atendido$/);
      expect(document.querySelector(`[data-label-for="${id}"] .town__badge--ok`)).not.toBeNull();
    }
    expect(document.querySelector('.town__svg .town__badge--low')).toBeNull();
    expect(root()).toHaveAttribute('data-feedback', 'none');
    const legend = within(screen.getByRole('list', { name: 'Legenda' }));
    expect(legend.getByText('Casas atendidas')).toBeInTheDocument();
    expect(legend.getByText('Torneiras secas: dinâmica abaixo de 10 mca')).toBeInTheDocument();
    expect(legend.getByText('Risco de rompimento: estática acima de 40 mca')).toBeInTheDocument();
  });

  it('marks houses whose static pressure is above the maximum', () => {
    const { evaluation } = solved('stage3');
    useAppStore.setState({
      evaluation: {
        ...evaluation,
        report: {
          ...evaluation.report,
          issues: [
            ...evaluation.report.issues,
            makeIssue({ check: 'maxStaticPressure', elementId: 'C', value: 45, limit: 40 }),
          ],
        },
      },
    });
    render(<TownView />);
    expect(element('node', 'C')).toHaveAttribute('data-status', 'high');
    expect(element('node', 'C')).toHaveAccessibleName(
      /pressão estática acima da máxima, risco de rompimento$/,
    );
    expect(document.querySelector('[data-label-for="C"] .town__badge--high')).not.toBeNull();
    expect(element('node', 'B')).toHaveAttribute('data-status', 'ok');
  });

  it('draws the town neutral before the first result', () => {
    const scenario = stage('stage2');
    useAppStore.setState({ scenario, diameters: initialDiameters(scenario), evaluation: null });
    render(<TownView />);
    for (const node of scenario.nodes) {
      expect(element('node', node.id)).toHaveAttribute('data-status', 'unknown');
      expect(element('node', node.id)).toHaveAccessibleName(/sem resultado$/);
    }
    expect(document.querySelector('.town__svg .town__badge')).toBeNull();
    expect(document.querySelector('.town__flow')).toBeNull();
    expect(element('pipe', 'T1')).toHaveAttribute('data-status', 'none');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calcule para ver pressões, vazões e velocidades.',
    );
    // Node and pipe ids are still labelled.
    expect(document.querySelector('[data-label-for="N1"]')).toHaveTextContent('N1');
    expect(document.querySelector('[data-label-for="T1"]')).toHaveTextContent('T1 · DN 75');
  });

  it('colours pipes by velocity class and shows the real flow direction', () => {
    // In stage 3 these diameters make the water run from C to B in T3 (defined as B → C).
    openStage('stage3', { T1: 100, T2: 50, T3: 50, T4: 150, T5: 150 });
    render(<TownView />);
    const t3 = element('pipe', 'T3');
    expect(t3).toHaveAttribute('data-direction', 'reverse');
    expect(t3).toHaveAccessibleName(/escoamento de C para B/);
    const c = stage('stage3').nodes.find((n) => n.id === 'C')!;
    expect(t3.querySelector('.town__flow')).toHaveAttribute('x1', String(c.x));
    expect(element('pipe', 'T1')).toHaveAttribute('data-direction', 'forward');
    for (const pipe of stage('stage3').pipes) {
      const status = element('pipe', pipe.id).getAttribute('data-status');
      expect(['low', 'ok', 'high']).toContain(status);
      expect(element('pipe', pipe.id)).toHaveClass(`netview__pipe--${status}`);
    }
    expect(document.querySelectorAll('.town__arrow')).toHaveLength(5);
  });

  it('changes the diameter of the selected pipe and marks the results as outdated', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<TownView />);
    expect(screen.getByText('Selecione um trecho para alterar o diâmetro.')).toBeInTheDocument();
    const widthOf = () =>
      Number(element('pipe', 'T2').querySelector('.town__pipe-line')!.getAttribute('stroke-width'));
    const before = widthOf();

    (element('pipe', 'T2') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    const picker = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
    await user.click(within(picker).getByRole('button', { name: /^DN 150,/ }));

    expect(useAppStore.getState().diameters.T2).toBe(150);
    expect(useAppStore.getState().stale).toBe(true);
    expect(widthOf()).toBeGreaterThan(before);
    expect(root()).toHaveClass('town--stale');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Resultados do cálculo anterior. Calcule novamente.',
    );
    expect(element('pipe', 'T2')).toHaveAccessibleName(/resultados desatualizados$/);
    expect(element('node', 'B')).toHaveAccessibleName(/resultados desatualizados$/);
    expect(document.querySelector('[data-label-for="T2"]')).toHaveTextContent('T2 · DN 150');
  });

  describe('feedback after Calcular / Verificar', () => {
    it('plays the success sequence once and then rests', () => {
      vi.useFakeTimers();
      openStage('stage3');
      render(<TownView />);
      expect(root()).toHaveAttribute('data-feedback', 'none');
      expect(root()).toHaveAttribute('data-motion', 'full');

      verify('stage3', stage('stage3').reference.diameters);
      expect(root()).toHaveAttribute('data-feedback', 'success');
      const fills = [...document.querySelectorAll<SVGPathElement>('.town__fill')];
      expect(fills).toHaveLength(5);
      // T1 leaves the reservoir first; T3 and T5 reach C last.
      const delay = (id: string) =>
        parseFloat(
          element('pipe', id)
            .querySelector<SVGPathElement>('.town__fill')!
            .style.getPropertyValue('--town-fill-delay'),
        );
      expect(delay('T1')).toBe(0);
      expect(delay('T2')).toBeGreaterThan(0);
      expect(delay('T5')).toBeGreaterThan(delay('T4'));
      // Houses light up in the order the water arrives: A, B, D, C.
      const lit = (id: string) =>
        parseFloat((element('node', id) as HTMLElement).style.getPropertyValue('--town-delay'));
      expect(lit('A')).toBeLessThan(lit('B'));
      expect(lit('B')).toBeLessThan(lit('D'));
      expect(lit('D')).toBeLessThan(lit('C'));
      expect(lit('C')).toBeLessThanOrEqual(1.8);

      act(() => {
        vi.advanceTimersByTime(2300);
      });
      expect(root()).toHaveAttribute('data-feedback', 'none');
      expect(document.querySelector('.town__fill')).toBeNull();
      expect(element('node', 'C')).toHaveAttribute('data-status', 'ok');
    });

    it('highlights the failing clusters after a failed check', () => {
      vi.useFakeTimers();
      openStage('stage3');
      render(<TownView />);
      verify('stage3');
      expect(root()).toHaveAttribute('data-feedback', 'failure');
      expect(document.querySelector('.town__fill')).toBeNull();
      expect(element('node', 'C')).toHaveAttribute('data-status', 'low');
      act(() => {
        vi.advanceTimersByTime(2700);
      });
      expect(root()).toHaveAttribute('data-feedback', 'none');
    });

    it('does not start when a verified stage is shown again', () => {
      solved('stage3');
      useAppStore.setState({ verifiedAt: 1234 });
      render(<TownView />);
      expect(root()).toHaveAttribute('data-feedback', 'none');
      expect(document.querySelector('.town__fill')).toBeNull();
    });

    it('skips the animation with reduced motion', () => {
      mockReducedMotion(true);
      openStage('stage3');
      render(<TownView />);
      expect(root()).toHaveAttribute('data-motion', 'reduced');
      verify('stage3', stage('stage3').reference.diameters);
      expect(root()).toHaveAttribute('data-feedback', 'success');
      // No fill lines: the town is already in its final state.
      expect(document.querySelector('.town__fill')).toBeNull();
      for (const id of ['A', 'B', 'C', 'D']) {
        expect(element('node', id)).toHaveAttribute('data-status', 'ok');
      }
    });

    it('brings the worst node into view when the view is zoomed in', async () => {
      mockReducedMotion(true);
      const user = userEvent.setup();
      const { scenario } = openStage('stage4');
      render(<TownView />);
      const fitted = worldTransform();
      const parse = (transform: string) => {
        const [, x, y, k] = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(transform)!;
        return { x: Number(x), y: Number(y), k: Number(k) };
      };

      // At the fitted view the worst node is visible: nothing moves.
      verify('stage4');
      expect(worldTransform()).toBe(fitted);

      for (let i = 0; i < 3; i++)
        await user.click(screen.getByRole('button', { name: 'Aproximar' }));
      const zoomed = parse(worldTransform());
      expect(zoomed.k).toBeGreaterThan(parse(fitted).k * 2);

      verify('stage4');
      const worst = housesSummary(scenario, useAppStore.getState().evaluation).worstNodeId;
      const node = scenario.nodes.find((n) => n.id === worst)!;
      const moved = parse(worldTransform());
      // Zoom pulled back to 1.5 × and the node sits in the middle of the 800 × 480 canvas.
      expect(moved.k).toBeCloseTo(parse(fitted).k * 1.5, 3);
      expect(moved.x + node.x * moved.k).toBeCloseTo(400, 0);
      expect(moved.y + node.y * moved.k).toBeCloseTo(240, 0);
    });
  });

  it('switches to English', () => {
    solved('stage1');
    useAppStore.setState({ lang: 'en' });
    render(<TownView />);
    expect(screen.getByRole('group', { name: 'Town map' })).toBeInTheDocument();
    expect(element('node', 'N3')).toHaveAccessibleName(
      'Node N3, 8 houses, demand 2.50 L/s, pressure 12.9 mca, served',
    );
    expect(element('pipe', 'T1')).toHaveAccessibleName(/^Pipe T1, DN 100 mm, flow 9\.50 L\/s/);
    expect(element('reservoir', 'R1')).toHaveAccessibleName(/elevated tank$/);
    expect(screen.getByText('Select a pipe to change its diameter.')).toBeInTheDocument();
    expect(screen.getByText('Houses served')).toBeInTheDocument();
    expect(document.querySelector('[data-label-for="N3"]')).toHaveTextContent('N3 12.9 mca');
  });
});
