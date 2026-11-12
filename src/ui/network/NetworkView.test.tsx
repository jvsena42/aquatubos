import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HeadLossFormula } from '../../engine/types';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario, SCENARIOS } from '../../scenarios';
import type { Diameters, Scenario } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { NetworkView } from './NetworkView';
import { nodeStatuses, pipeStatuses } from './status';

vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

/** In stage 3 these diameters make the water run from C to B in T3 (defined as B → C). */
const REVERSING: Diameters = { T1: 100, T2: 50, T3: 50, T4: 150, T5: 150 };

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

/** Opens a real stage with a real evaluation, like the store does after the worker answers. */
function openStage(id: string, diameters?: Diameters, formula?: HeadLossFormula) {
  const scenario = stage(id);
  const design = diameters ?? initialDiameters(scenario);
  const evaluation = evaluateStage(scenario, design, formula ?? scenario.formula);
  useAppStore.setState({
    scenario,
    diameters: design,
    formula: formula ?? scenario.formula,
    evaluation,
  });
  return { scenario, evaluation };
}

const element = (type: string, id: string): Element => {
  const found = document.querySelector(`[data-element="${type}"][data-id="${id}"]`);
  if (!found) throw new Error(`no ${type} ${id}`);
  return found;
};

const pt = (value: number, digits = 2) =>
  value
    .toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace('-', '−');

describe('NetworkView', () => {
  beforeEach(() => resetStore());

  it.each(SCENARIOS.map((s) => s.id))('draws every element of %s', (id) => {
    const { scenario } = openStage(id);
    render(<NetworkView />);
    expect(document.querySelectorAll('[data-element="pipe"]')).toHaveLength(scenario.pipes.length);
    expect(document.querySelectorAll('[data-element="node"]')).toHaveLength(scenario.nodes.length);
    expect(document.querySelectorAll('[data-element="reservoir"]')).toHaveLength(
      scenario.reservoirs.length,
    );
    expect(document.querySelectorAll('[data-element="pump"]')).toHaveLength(scenario.pumps.length);
    for (const pipe of scenario.pipes) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^Trecho ${pipe.id},`) }),
      ).toHaveAttribute('tabindex', '0');
    }
    for (const node of scenario.nodes) {
      expect(screen.getByRole('button', { name: new RegExp(`^Nó ${node.id},`) })).toHaveAttribute(
        'tabindex',
        '0',
      );
    }
  });

  it('names pipes and nodes with the values of the evaluation', () => {
    const { evaluation } = openStage('stage3');
    render(<NetworkView />);
    const flow = pt(evaluation.result.pipes.T1!.flow * 1000);
    const velocity = pt(Math.abs(evaluation.result.pipes.T1!.velocity));
    expect(element('pipe', 'T1')).toHaveAccessibleName(
      `Trecho T1, DN 75 mm, vazão ${flow} L/s, velocidade ${velocity} m/s, escoamento de R1 para A, velocidade dentro dos limites`,
    );
    const pressure = pt(evaluation.result.nodes.A!.pressure);
    expect(element('node', 'A')).toHaveAccessibleName(
      `Nó A, demanda 1,00 L/s, pressão ${pressure} mca, pressão dinâmica abaixo da mínima`,
    );
    expect(element('reservoir', 'R1')).toHaveAccessibleName(
      "Reservatório R1, nível d'água 128,00 m",
    );
    // Visible labels: DN and flow on the pipe, pressure at the node.
    expect(element('pipe', 'T1')).toHaveTextContent(`T1 · DN 75${flow} L/s`);
    expect(element('node', 'A')).toHaveTextContent(
      `A${pt(evaluation.result.nodes.A!.pressure, 1)} mca`,
    );
  });

  it('selects with a click and clears with a click on empty space', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<NetworkView />);

    await user.click(element('pipe', 'T2'));
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
    expect(element('pipe', 'T2')).toHaveAttribute('aria-pressed', 'true');
    expect(element('pipe', 'T2')).toHaveClass('netview__el--selected');
    expect(element('pipe', 'T1')).toHaveAttribute('aria-pressed', 'false');

    await user.click(element('node', 'C'));
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'C' });

    await user.click(element('reservoir', 'R1'));
    expect(useAppStore.getState().selection).toEqual({ type: 'reservoir', id: 'R1' });

    await user.click(screen.getByRole('group', { name: 'Desenho da rede' }));
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('selects the pump of a pumped stage', async () => {
    const user = userEvent.setup();
    openStage('stage5');
    render(<NetworkView />);
    await user.click(element('pump', 'B1'));
    expect(useAppStore.getState().selection).toEqual({ type: 'pump', id: 'B1' });
  });

  it('selects with Enter and Space and clears with Escape', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<NetworkView />);

    (element('pipe', 'T4') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T4' });

    (element('node', 'B') as HTMLElement).focus();
    await user.keyboard(' ');
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'B' });

    await user.keyboard('{Escape}');
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('does not select when the pointer drags the drawing', () => {
    openStage('stage3');
    render(<NetworkView />);
    const svg = screen.getByRole('group', { name: 'Desenho da rede' });
    const pipe = element('pipe', 'T1');
    const before = pipe.querySelector('.netview__pipe-line')!.getAttribute('x1');

    fireEvent.pointerDown(pipe, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.click(pipe);

    expect(useAppStore.getState().selection).toBeNull();
    const after = element('pipe', 'T1').querySelector('.netview__pipe-line')!.getAttribute('x1');
    expect(Number(after)).toBeCloseTo(Number(before) + 40, 6);
  });

  it('zooms with the buttons and fits again', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<NetworkView />);
    const span = () => {
      const line = element('pipe', 'T1').querySelector('.netview__pipe-line')!;
      return Number(line.getAttribute('x2')) - Number(line.getAttribute('x1'));
    };
    const fitted = span();
    await user.click(screen.getByRole('button', { name: 'Aproximar' }));
    expect(span()).toBeCloseTo(fitted * 1.4, 6);
    await user.click(screen.getByRole('button', { name: 'Afastar' }));
    await user.click(screen.getByRole('button', { name: 'Afastar' }));
    expect(span()).toBeCloseTo(fitted / 1.4, 6);
    await user.click(screen.getByRole('button', { name: 'Enquadrar a rede' }));
    expect(span()).toBeCloseTo(fitted, 6);
  });

  it('changes the diameter of the selected pipe and marks the results as outdated', async () => {
    const user = userEvent.setup();
    openStage('stage3');
    render(<NetworkView />);
    expect(screen.getByText('Selecione um trecho para alterar o diâmetro.')).toBeInTheDocument();

    await user.click(element('pipe', 'T2'));
    const picker = within(screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' }));
    expect(picker.getByRole('button', { name: /^DN 50,/ })).toHaveAttribute('aria-pressed', 'true');
    expect(picker.getByRole('button', { name: /^DN 100, R\$\s65,00 por metro$/ })).toBeEnabled();

    const thin = Number(
      element('pipe', 'T2').querySelector('.netview__pipe-line')!.getAttribute('stroke-width'),
    );
    await user.click(picker.getByRole('button', { name: /^DN 100,/ }));

    expect(useAppStore.getState().diameters.T2).toBe(100);
    expect(useAppStore.getState().stale).toBe(true);
    expect(picker.getByRole('button', { name: /^DN 100,/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The DN label and the line width follow the design; the old results stay, dimmed.
    expect(element('pipe', 'T2')).toHaveTextContent('T2 · DN 100');
    expect(
      Number(
        element('pipe', 'T2').querySelector('.netview__pipe-line')!.getAttribute('stroke-width'),
      ),
    ).toBeGreaterThan(thin);
    expect(document.querySelector('.netview')).toHaveClass('netview--stale');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Resultados do cálculo anterior. Calcule novamente.',
    );
    expect(element('pipe', 'T2')).toHaveAccessibleName(/resultados desatualizados$/);
  });

  it('does not let a fixed pipe change', async () => {
    const user = userEvent.setup();
    const { scenario } = openStage('stage3');
    useAppStore.setState({
      scenario: {
        ...scenario,
        pipes: scenario.pipes.map((p) => (p.id === 'T1' ? { ...p, fixed: true } : p)),
      },
    });
    render(<NetworkView />);
    await user.click(element('pipe', 'T1'));
    const picker = within(screen.getByRole('group', { name: 'Diâmetro nominal do trecho T1' }));
    for (const button of picker.getAllByRole('button')) expect(button).toBeDisabled();
    expect(
      screen.getByText('O diâmetro deste trecho é fixo nesta etapa e não pode ser alterado.'),
    ).toBeInTheDocument();
    expect(element('pipe', 'T1')).toHaveAccessibleName(/diâmetro fixo/);
  });

  it('draws the flow marks in the real direction of the flow', () => {
    const { evaluation } = openStage('stage3', REVERSING);
    expect(evaluation.result.pipes.T3!.flow).toBeLessThan(0);
    expect(evaluation.result.pipes.T2!.flow).toBeGreaterThan(0);
    render(<NetworkView />);

    const center = (id: string) => {
      const dot = element('node', id).querySelector('.netview__node-dot')!;
      return { x: dot.getAttribute('cx'), y: dot.getAttribute('cy') };
    };
    const flowLine = (id: string) => {
      const line = element('pipe', id).querySelector('.netview__flow')!;
      return {
        from: { x: line.getAttribute('x1'), y: line.getAttribute('y1') },
        to: { x: line.getAttribute('x2'), y: line.getAttribute('y2') },
      };
    };

    // T2 is defined A → B and flows that way.
    expect(element('pipe', 'T2')).toHaveAttribute('data-direction', 'forward');
    expect(flowLine('T2')).toEqual({ from: center('A'), to: center('B') });
    // T3 is defined B → C but the water runs from C to B.
    expect(element('pipe', 'T3')).toHaveAttribute('data-direction', 'reverse');
    expect(flowLine('T3')).toEqual({ from: center('C'), to: center('B') });
    expect(element('pipe', 'T3')).toHaveAccessibleName(/escoamento de C para B/);

    // The arrowhead points the same way: its rotation is the angle from C to B.
    const b = center('B');
    const c = center('C');
    const angle =
      (Math.atan2(Number(b.y) - Number(c.y), Number(b.x) - Number(c.x)) * 180) / Math.PI;
    const transform = element('pipe', 'T3')
      .querySelector('.netview__arrow')!
      .getAttribute('transform');
    expect(transform).toContain(`rotate(${angle})`);
  });

  it('marks failing and passing nodes with a class and a glyph, never by colour alone', () => {
    openStage('stage3');
    const view = render(<NetworkView />);
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(element('node', id)).toHaveClass('netview__node--low');
      expect(element('node', id).querySelector('.netview__glyph')).not.toBeNull();
    }
    view.unmount();

    openStage('stage3', stage('stage3').reference.diameters);
    render(<NetworkView />);
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(element('node', id)).toHaveClass('netview__node--ok');
      expect(element('node', id).querySelector('.netview__glyph')).toBeNull();
      expect(element('node', id)).toHaveAccessibleName(/pressão dentro dos limites$/);
    }
    expect(
      within(screen.getByRole('list', { name: 'Legenda' })).getAllByRole('listitem').length,
    ).toBeGreaterThan(4);
  });

  it('marks a node whose static pressure is above the maximum', () => {
    const { scenario, evaluation } = openStage('stage3', stage('stage3').reference.diameters);
    useAppStore.setState({
      evaluation: {
        ...evaluation,
        report: {
          ...evaluation.report,
          staticPressure: { ...evaluation.report.staticPressure, C: 45 },
        },
      },
    });
    render(<NetworkView />);
    expect(scenario.checks.maxStaticPressure).not.toBe('off');
    expect(element('node', 'C')).toHaveClass('netview__node--high');
    expect(element('node', 'C')).toHaveAccessibleName(/pressão estática acima da máxima$/);
    expect(element('node', 'C').querySelector('.netview__glyph')).not.toBeNull();
  });

  it('leaves the pump discharge node without demand neutral', () => {
    openStage('stage5');
    render(<NetworkView />);
    expect(element('node', 'J1')).toHaveClass('netview__node--none');
    expect(element('node', 'N2')).toHaveClass('netview__node--low');
  });

  it('colours pipes by velocity class', () => {
    const { evaluation } = openStage('stage4');
    render(<NetworkView />);
    const issues = evaluation.report.issues;
    expect(issues.some((i) => i.check === 'maxVelocity' && i.elementId === 'T2')).toBe(true);
    expect(element('pipe', 'T2')).toHaveClass('netview__pipe--high');
    expect(element('pipe', 'T11')).toHaveClass('netview__pipe--low');
    expect(element('pipe', 'T1')).toHaveClass('netview__pipe--ok');
  });

  it.each(SCENARIOS.map((s) => s.id))(
    'statuses of %s agree with the issues of the checks',
    (id) => {
      const scenario = stage(id);
      for (const design of [initialDiameters(scenario), scenario.reference.diameters]) {
        const evaluation = evaluateStage(scenario, design);
        const failing = (check: string) =>
          evaluation.report.issues
            .filter((issue) => issue.check === check)
            .map((issue) => issue.elementId)
            .sort();
        const nodes = nodeStatuses(evaluation, scenario.checks);
        const pipes = pipeStatuses(evaluation, scenario.checks);
        const where = <T,>(record: Record<string, T>, test: (value: T) => boolean) =>
          Object.keys(record)
            .filter((key) => test(record[key]!))
            .sort();
        expect(where(nodes, (n) => n.low)).toEqual(failing('minDynamicPressure'));
        expect(where(nodes, (n) => n.high)).toEqual(failing('maxStaticPressure'));
        expect(where(pipes, (p) => p === 'low')).toEqual(failing('minVelocity'));
        expect(where(pipes, (p) => p === 'high')).toEqual(failing('maxVelocity'));
      }
    },
  );

  it('draws the network neutral before the first solve', () => {
    const scenario = stage('stage3');
    useAppStore.setState({ scenario, diameters: initialDiameters(scenario) });
    render(<NetworkView />);
    expect(element('node', 'A')).toHaveClass('netview__node--none');
    expect(element('pipe', 'T1')).toHaveClass('netview__pipe--none');
    expect(element('pipe', 'T1')).toHaveAttribute('data-direction', 'none');
    expect(element('pipe', 'T1').querySelector('.netview__flow')).toBeNull();
    expect(element('pipe', 'T1')).toHaveAccessibleName('Trecho T1, DN 75 mm');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calcule para ver pressões, vazões e velocidades.',
    );
  });

  it('switches to English', () => {
    openStage('stage3');
    useAppStore.setState({ lang: 'en' });
    render(<NetworkView />);
    expect(screen.getByRole('group', { name: 'Network drawing' })).toBeInTheDocument();
    expect(element('pipe', 'T1')).toHaveAccessibleName(/^Pipe T1, DN 75 mm, flow 10\.50 L\/s/);
    expect(element('node', 'A')).toHaveAccessibleName(/dynamic pressure below the minimum$/);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByText('Select a pipe to change its diameter.')).toBeInTheDocument();
  });
});
