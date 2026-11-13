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
import { distanceToSegment } from '../network/hit';
import { mockMatchMedia } from '../network/mockMatchMedia';
import { NetworkView } from '../network/NetworkView';
import { COARSE_QUERY, PHONE_QUERY } from '../shell/breakpoints';
import { housePreview, previewStatuses, TownView } from './TownView';

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
  });

  it('shows the three house states in the legend, each with its badge', async () => {
    const user = userEvent.setup();
    // Stage 1 has no static pressure check and no result yet: the three states are there anyway.
    const scenario = stage('stage1');
    useAppStore.setState({ scenario, diameters: initialDiameters(scenario), evaluation: null });
    render(<TownView />);
    const legend = within(screen.getByRole('list', { name: 'Legenda' }));
    for (const [status, name] of [
      ['ok', 'Casas atendidas'],
      ['low', 'Torneiras secas: dinâmica abaixo de 10 mca'],
      ['high', 'Risco de rompimento: estática acima de 40 mca'],
    ] as const) {
      const symbol = legend.getByRole('img', { name });
      expect(symbol.querySelector(`.town__badge--${status}`)).not.toBeNull();
      expect(symbol).toHaveTextContent('');
    }
    // The texts are in the help of the legend, next to the same badges.
    await user.click(screen.getByRole('button', { name: 'Ajuda: Legenda' }));
    const help = screen.getByRole('note', { name: 'Ajuda: Legenda' });
    expect(help).toHaveTextContent('Risco de rompimento: estática acima de 40 mca');
    expect(help.querySelector('.town__badge--high')).not.toBeNull();
    expect(help.querySelector('.town__badge--low')).not.toBeNull();
    expect(help.querySelector('.town__badge--ok')).not.toBeNull();
  });

  it('shows the burst-risk state for a real static pressure above 40 mca', () => {
    // Stage 2 with node N3 lowered to 80 m: water level 135 m − 80 m = 55 mca at rest.
    const base = stage('stage2');
    const scenario: Scenario = {
      ...base,
      nodes: base.nodes.map((n) => (n.id === 'N3' ? { ...n, elevation: 80 } : n)),
    };
    const diameters = base.reference.diameters;
    const evaluation = evaluateStage(scenario, diameters, scenario.formula);
    expect(evaluation.report.staticPressure.N3).toBeGreaterThan(40);
    useAppStore.setState({ scenario, diameters, formula: scenario.formula, evaluation });
    render(<TownView />);

    const cluster = element('node', 'N3');
    expect(cluster).toHaveAttribute('data-status', 'high');
    expect(cluster).toHaveAccessibleName(
      /^Nó N3, \d+ casas, .*pressão estática acima da máxima, risco de rompimento$/,
    );
    const chip = document.querySelector('[data-label-kind="node"][data-label-for="N3"]')!;
    expect(chip).toHaveClass('town__pill--high');
    expect(chip.querySelector('.town__badge--high')).not.toBeNull();
    expect(chip.querySelector('.town__badge--ok, .town__badge--low')).toBeNull();
    // The other nodes are not marked, and the worst node for the HUD is this one.
    expect(element('node', 'N1')).toHaveAttribute('data-status', 'ok');
    expect(housesSummary(scenario, evaluation).worstNodeId).toBe('N3');
  });

  it('previews the three house states with ?debug=high-static, and only then', () => {
    expect(housePreview('')).toBe(false);
    expect(housePreview('?debug=other')).toBe(false);
    expect(housePreview('?debug=high-static')).toBe(true);
    const scenario = stage('stage2');
    const statuses = previewStatuses(scenario);
    const demand = scenario.nodes.filter((n) => n.demandLps > 0).map((n) => statuses[n.id]);
    expect(demand.slice(0, 3)).toEqual(['high', 'low', 'ok']);

    solved('stage2');
    const view = render(<TownView />);
    expect(root()).not.toHaveAttribute('data-preview');
    expect(document.querySelector('[data-element="node"][data-status="high"]')).toBeNull();
    view.unmount();

    window.history.replaceState(null, '', '?debug=high-static');
    try {
      render(<TownView />);
      expect(root()).toHaveAttribute('data-preview', 'house-states');
      for (const status of ['high', 'low', 'ok']) {
        expect(
          document.querySelector(`[data-element="node"][data-status="${status}"]`),
        ).not.toBeNull();
        expect(document.querySelector(`.town__svg .town__badge--${status}`)).not.toBeNull();
      }
    } finally {
      window.history.replaceState(null, '', window.location.pathname);
    }
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

  it('has no diameter picker on a desktop and follows a new diameter', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<TownView />);
    const widthOf = () =>
      Number(element('pipe', 'T2').querySelector('.town__pipe-line')!.getAttribute('stroke-width'));
    const before = widthOf();

    (element('pipe', 'T2') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
    // The picker is in the calculation panel next to the map, not under it.
    expect(screen.queryByRole('group', { name: /^Diâmetro nominal/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Selecione um trecho')).not.toBeInTheDocument();
    act(() => useAppStore.getState().setDiameter('T2', 150));

    expect(useAppStore.getState().stale).toBe(true);
    expect(widthOf()).toBeGreaterThan(before);
    expect(root()).toHaveClass('town--stale');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Desatualizado');
    expect(status).toHaveTextContent('Resultados do cálculo anterior. Calcule novamente.');
    expect(status.closest('.town__canvas')).toBeNull();
    expect(element('pipe', 'T2')).toHaveAccessibleName(/resultados desatualizados$/);
    expect(element('node', 'B')).toHaveAccessibleName(/resultados desatualizados$/);
    // Selected: id, DN and flow. The others: id and DN, without words.
    const label = (id: string) => document.querySelector(`[data-label-for="${id}"]`)!;
    expect(label('T2')).toHaveTextContent(/^T2 · DN 150 · [\d,]+ L\/s$/);
    expect(label('T2')).toHaveAttribute('data-label-kind', 'pipe');
    expect(label('T1')).toHaveTextContent(/^T1 · DN \d+$/);
    expect(label('R1')).toHaveAttribute('data-label-kind', 'reservoir');
    expect(label('R1')).toHaveTextContent(/^R1 [\d,]+ m$/);
    expect(label('A')).toHaveAttribute('data-label-kind', 'node');
  });

  it('marks a pipe outside the velocity limits with an icon on the street', () => {
    solved('stage4');
    render(<TownView />);
    const slow = [...document.querySelectorAll('[data-element="pipe"][data-status="low"]')];
    expect(slow.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.town__overlay .netview__pipe-mark')).toHaveLength(
      slow.length,
    );
    expect(document.querySelector('.town__overlay')).not.toHaveTextContent(/V baixa|low V/);
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

  describe('on a phone', () => {
    let restore: (() => void)[] = [];
    const parse = (transform: string) => {
      const match = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(transform)!;
      return { x: Number(match[1]), y: Number(match[2]), k: Number(match[3]) };
    };
    /** Plan (m) to screen (px) with the transform of the world group. */
    const project = (p: { x: number; y: number }) => {
      const t = parse(worldTransform());
      return { x: t.x + p.x * t.k, y: t.y + p.y * t.k };
    };
    /** A 360 × 400 px canvas at the top left of the page. */
    const layOut = () => {
      const width = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
      const height = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
      Object.defineProperty(Element.prototype, 'clientWidth', {
        configurable: true,
        get: () => 360,
      });
      Object.defineProperty(Element.prototype, 'clientHeight', {
        configurable: true,
        get: () => 400,
      });
      const rect = SVGElement.prototype.getBoundingClientRect;
      SVGElement.prototype.getBoundingClientRect = function () {
        return this.classList.contains('town__svg')
          ? DOMRect.fromRect({ x: 0, y: 0, width: 360, height: 400 })
          : rect.call(this);
      };
      restore.push(() => {
        Object.defineProperty(Element.prototype, 'clientWidth', width!);
        Object.defineProperty(Element.prototype, 'clientHeight', height!);
        SVGElement.prototype.getBoundingClientRect = rect;
      });
    };
    const tap = (x: number, y: number, target: Element) => {
      const init = { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, button: 0 };
      fireEvent.pointerDown(target, init);
      fireEvent.pointerUp(target, init);
      fireEvent.click(target, { clientX: x, clientY: y });
    };

    beforeEach(() => {
      restore = [mockMatchMedia([PHONE_QUERY, COARSE_QUERY])];
    });
    afterEach(() => {
      for (const undo of [...restore].reverse()) undo();
    });

    it('gives pipes, nodes, the reservoir and the pump hit areas of 44 px on screen', () => {
      layOut();
      openStage('stage5');
      render(<TownView />);
      const { k } = parse(worldTransform());
      const onScreen = (el: Element, attribute: string) => Number(el.getAttribute(attribute)) * k;
      for (const pipe of document.querySelectorAll('[data-element="pipe"] line.town__hit')) {
        expect(onScreen(pipe, 'stroke-width')).toBeGreaterThanOrEqual(44 - 1e-6);
      }
      for (const hit of document.querySelectorAll(
        '.town__plaza-hit, [data-element="reservoir"] .town__hit, [data-element="pump"] circle.town__hit',
      )) {
        expect(2 * onScreen(hit, 'r')).toBeGreaterThanOrEqual(44 - 1e-6);
      }
      expect(document.querySelectorAll('[data-element="pump"] circle.town__hit')).toHaveLength(1);
    });

    it('keeps the smaller hit areas for a mouse', () => {
      restore.push(mockMatchMedia([]));
      layOut();
      openStage('stage1');
      render(<TownView />);
      const { k } = parse(worldTransform());
      const hit = element('pipe', 'T1').querySelector('line.town__hit')!;
      expect(Number(hit.getAttribute('stroke-width')) * k).toBeLessThan(44);
    });

    it('selects the street nearest to the tap although houses lie under the finger', () => {
      layOut();
      const { scenario } = openStage('stage4');
      render(<TownView />);
      const svg = document.querySelector('.town__svg')!;
      const at = (id: string) => project(scenario.nodes.find((n) => n.id === id)!);
      const pipe = scenario.pipes.find((p) => p.id === 'T2')!;
      const a = at(pipe.from);
      const b = at(pipe.to);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };

      // 5 px beside the street, with the event on a house of the next node (painted on top).
      tap(mid.x + 5 * normal.x, mid.y + 5 * normal.y, document.querySelector('.town__house')!);
      expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });

      // On the junction: the node, even with the event on the hit area of the street.
      tap(a.x + 2, a.y + 2, element('pipe', 'T2').querySelector('.town__hit')!);
      expect(useAppStore.getState().selection).toEqual({ type: 'node', id: pipe.from });

      // On the reservoir.
      const r1 = project(scenario.reservoirs[0]!);
      tap(r1.x, r1.y, svg);
      expect(useAppStore.getState().selection).toEqual({
        type: 'reservoir',
        id: scenario.reservoirs[0]!.id,
      });

      // In a corner of the canvas, far from the town: clears.
      tap(4, 396, svg);
      expect(useAppStore.getState().selection).toBeNull();
    });

    it('selects a node by a tap on one of its houses away from the streets', () => {
      layOut();
      const { scenario } = openStage('stage1');
      render(<TownView />);
      const svg = document.querySelector('.town__svg')!;
      const { k } = parse(worldTransform());
      // The house farthest (on screen) from every street.
      const segments = scenario.pipes.map((p) => {
        const end = (id: string) =>
          project([...scenario.nodes, ...scenario.reservoirs].find((n) => n.id === id)!);
        return { a: end(p.from), b: end(p.to) };
      });
      let best: { node: string; x: number; y: number; distance: number } | null = null;
      for (const cluster of document.querySelectorAll('.town__cluster')) {
        for (const house of cluster.querySelectorAll('.town__house')) {
          const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(house.getAttribute('transform')!)!;
          const p = project({ x: Number(match[1]), y: Number(match[2]) });
          const distance = Math.min(...segments.map((s) => distanceToSegment(p, s.a, s.b)));
          if (!best || distance > best.distance) {
            best = { node: cluster.getAttribute('data-id')!, ...p, distance };
          }
        }
      }
      expect(best!.distance).toBeGreaterThan(8 + 30 * k);
      tap(best!.x, best!.y, svg);
      expect(useAppStore.getState().selection).toEqual({ type: 'node', id: best!.node });
    });

    it('draws less when the town is far away and everything from close', async () => {
      const user = userEvent.setup();
      layOut();
      openStage('stage4');
      render(<TownView />);
      // Fitted in 360 px the town is at about 0.3 px per metre.
      expect(parse(worldTransform()).k).toBeLessThan(0.5);
      expect(root()).toHaveClass('town--detail-far');
      expect(document.querySelectorAll('.town__tree--small').length).toBeGreaterThan(0);
      expect(
        document.querySelectorAll('.town__tree:not(.town__tree--small)').length,
      ).toBeGreaterThan(0);

      const zoomIn = screen.getByRole('button', { name: 'Aproximar' });
      await user.click(zoomIn);
      await user.click(zoomIn);
      expect(root()).toHaveClass('town--detail-mid');
      expect(root()).not.toHaveClass('town--detail-far');
      for (let i = 0; i < 3; i += 1) await user.click(zoomIn);
      expect(root()).toHaveClass('town--detail-near');

      await user.click(screen.getByRole('button', { name: 'Enquadrar a rede' }));
      expect(root()).toHaveClass('town--detail-far');
    });

    it('has the legend help in the control strip and the diameter bar under the map', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      solved('stage1');
      render(<TownView />);
      expect(screen.queryByText('Casas atendidas')).not.toBeInTheDocument();
      expect(screen.getByText('Selecione um trecho')).toBeInTheDocument();
      const strip = screen.getByRole('group', { name: 'Controles do mapa' });
      expect(strip.closest('.town__canvas')).not.toBeNull();
      expect(strip.querySelectorAll('[data-overlay-control]')).toHaveLength(4);
      await user.click(within(strip).getByRole('button', { name: 'Ajuda: Legenda' }));
      expect(screen.getByRole('dialog', { name: 'Legenda' })).toHaveTextContent('Casas atendidas');
      await user.click(screen.getByRole('button', { name: 'Fechar' }));

      await user.click(element('pipe', 'T2').querySelector('.town__hit')!);
      const picker = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
      expect(picker).toHaveAttribute('id', 'dn-bar');
      expect(picker.closest('.town__canvas')).toBeNull();
      expect(picker.closest('.dn-picker')).toHaveClass('dn-picker--bar');
      expect(within(picker).getAllByRole('button')).toHaveLength(7);
      await user.click(within(picker).getByRole('button', { name: /^DN 150,/ }));
      expect(useAppStore.getState().diameters.T2).toBe(150);
      expect(document.querySelector('#dn-bar [aria-pressed="true"]')).toHaveAccessibleName(
        /^DN 150,/,
      );
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
    expect(screen.getByRole('img', { name: 'Houses served' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help: Legend' })).toBeInTheDocument();
    expect(document.querySelector('[data-label-for="N3"]')).toHaveTextContent('N3 12.9 mca');
  });
});
