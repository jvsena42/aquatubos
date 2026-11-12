import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { HeadLossFormula } from '../../engine/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { HardyCrossTable } from './HardyCrossTable';

function open(stageId: string, formula?: HeadLossFormula) {
  const scenario = getScenario(stageId)!;
  const diameters = scenario.reference.diameters;
  const evaluation = evaluateStage(scenario, diameters, formula ?? scenario.formula);
  useAppStore.setState({ scenario, diameters, evaluation, formula: formula ?? scenario.formula });
  return { scenario, evaluation };
}

const pt = (value: number, digits: number) =>
  (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function cells(row: HTMLElement): string[] {
  return [...row.querySelectorAll('th, td')].map((cell) => cell.textContent ?? '');
}

describe('HardyCrossTable', () => {
  beforeEach(() => resetStore());

  it('shows a hint before there is a result', () => {
    useAppStore.setState({ scenario: getScenario('stage3')! });
    render(<HardyCrossTable />);
    expect(screen.getByText(/Ainda não há resultados/)).toBeInTheDocument();
  });

  it('explains that a branched network has no loops to balance', () => {
    const { evaluation } = open('stage2');
    expect(evaluation.hardyCross).toBeUndefined();
    render(<HardyCrossTable />);
    expect(screen.getByText(/Esta rede não tem anéis \(é ramificada\)/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('states the correction formula and the exponent of the formula in use', () => {
    open('stage3');
    render(<HardyCrossTable />);
    expect(screen.getByText('ΔQ = −Σh / Σ(n·|h|/|Q|)')).toBeInTheDocument();
    expect(screen.getByText(/^n = 1,852 \(Hazen-Williams\)/)).toBeInTheDocument();
  });

  it('uses n = 2 with Darcy-Weisbach', () => {
    open('stage3', 'darcy-weisbach');
    render(<HardyCrossTable />);
    expect(screen.getByText(/^n = 2 \(Darcy-Weisbach\)/)).toBeInTheDocument();
  });

  it('shows the first iteration of the loop of stage 3 with signed values', () => {
    const { evaluation } = open('stage3');
    const hc = evaluation.hardyCross!.result;
    const step = hc.iterations[0]!.loops[0]!;
    render(<HardyCrossTable />);

    expect(screen.getByText(`Convergiu em ${hc.iterations.length} iterações`)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Anel I, Iteração 1' });
    const rows = within(table).getAllByRole('row');
    // header, 4 pipes, 3 footer rows
    expect(rows).toHaveLength(8);
    step.rows.forEach((row, index) => {
      expect(cells(rows[index + 1]!)).toEqual([
        row.pipeId,
        row.direction === 1 ? '+no sentido do anel' : '−contra o sentido do anel',
        pt(row.flow * 1000, 3),
        pt(row.headLoss, 4),
        pt(row.nHeadLossOverFlow / 1000, 4),
        pt(row.correctedFlow * 1000, 3),
      ]);
    });
    // T5 and T4 are drawn against the clockwise direction and carry water that way.
    expect(step.rows.map((r) => r.direction)).toEqual([1, 1, -1, -1]);
    expect(step.rows[2]!.flow).toBeLessThan(0);
    expect(step.rows[2]!.headLoss).toBeLessThan(0);

    expect(cells(rows[5]!)[1]).toBe(pt(step.sumHeadLoss, 4));
    expect(cells(rows[6]!)[1]).toBe(pt(step.sumNHeadLossOverFlow / 1000, 4));
    expect(cells(rows[7]!)[1]).toBe(pt(step.deltaQ * 1000, 4));
    // The displayed columns reproduce the correction: ΔQ (L/s) = −Σh / Σ(n·|h|/|Q|).
    expect(step.deltaQ * 1000).toBeCloseTo(
      -step.sumHeadLoss / (step.sumNHeadLossOverFlow / 1000),
      9,
    );
    // One loop: the corrected flow is Q + ΔQ.
    for (const row of step.rows) {
      expect(row.correctedFlow).toBeCloseTo(row.flow + step.deltaQ, 12);
    }
  });

  it('steps through the iterations and ends with Σh ≈ 0', async () => {
    const user = userEvent.setup();
    const { evaluation } = open('stage3');
    const { iterations } = evaluation.hardyCross!.result;
    const total = iterations.length;
    render(<HardyCrossTable />);

    const picker = screen.getByRole('combobox', { name: 'Iteração mostrada' });
    const first = screen.getByRole('button', { name: 'Primeira iteração' });
    const previous = screen.getByRole('button', { name: 'Iteração anterior' });
    const next = screen.getByRole('button', { name: 'Próxima iteração' });
    const last = screen.getByRole('button', { name: 'Última iteração' });
    expect(picker).toHaveDisplayValue(`Iteração 1 de ${total}`);
    expect(first).toBeDisabled();
    expect(previous).toBeDisabled();

    await user.click(next);
    expect(picker).toHaveDisplayValue(`Iteração 2 de ${total}`);
    expect(screen.getByRole('table', { name: 'Anel I, Iteração 2' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Anel I, Iteração 1' })).not.toBeInTheDocument();
    // The flow of an iteration is the corrected flow of the one before.
    expect(iterations[1]!.loops[0]!.rows[0]!.flow).toBe(
      iterations[0]!.loops[0]!.rows[0]!.correctedFlow,
    );

    await user.click(previous);
    expect(picker).toHaveDisplayValue(`Iteração 1 de ${total}`);

    await user.click(last);
    expect(picker).toHaveDisplayValue(`Iteração ${total} de ${total}`);
    expect(next).toBeDisabled();
    expect(last).toBeDisabled();
    const finalStep = iterations[total - 1]!.loops[0]!;
    expect(Math.abs(finalStep.sumHeadLoss)).toBeLessThan(1e-4);
    const rows = within(
      screen.getByRole('table', { name: `Anel I, Iteração ${total}` }),
    ).getAllByRole('row');
    expect(cells(rows[5]!)[1]).toBe('0,0000');
    expect(cells(rows[7]!)[1]).toBe('0,0000');

    await user.click(first);
    expect(picker).toHaveDisplayValue(`Iteração 1 de ${total}`);
    await user.selectOptions(picker, '2');
    expect(screen.getByRole('table', { name: 'Anel I, Iteração 3' })).toBeInTheDocument();
  });

  it('lists the largest correction of each iteration and jumps to it', async () => {
    const user = userEvent.setup();
    const { evaluation } = open('stage3');
    const { iterations } = evaluation.hardyCross!.result;
    render(<HardyCrossTable />);

    const list = screen.getByRole('list', { name: /Maior \|ΔQ\| por iteração/ });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(iterations.length);
    expect(items[0]).toHaveTextContent(`1${pt(iterations[0]!.maxDeltaQ * 1000, 4)}`);
    expect(items[items.length - 1]).toHaveTextContent('< 0,0001');
    for (let i = 1; i < iterations.length; i++) {
      expect(iterations[i]!.maxDeltaQ).toBeLessThan(iterations[i - 1]!.maxDeltaQ);
    }

    await user.click(within(items[2]!).getByRole('button'));
    expect(screen.getByRole('table', { name: 'Anel I, Iteração 3' })).toBeInTheDocument();
    expect(within(items[2]!).getByRole('button')).toHaveAttribute('aria-current', 'step');
  });

  it('can show all iterations at once', async () => {
    const user = userEvent.setup();
    const { evaluation } = open('stage3');
    const total = evaluation.hardyCross!.result.iterations.length;
    render(<HardyCrossTable />);
    await user.click(screen.getByRole('checkbox', { name: 'Mostrar todas as iterações' }));
    expect(screen.getAllByRole('table', { name: /^Anel I, Iteração/ })).toHaveLength(total);
    expect(screen.getByRole('button', { name: 'Próxima iteração' })).toBeDisabled();
  });

  it('compares the final flows with the solver', () => {
    const { scenario, evaluation } = open('stage3');
    const hc = evaluation.hardyCross!.result;
    render(<HardyCrossTable />);

    const table = screen.getByRole('table', { name: 'Vazões finais: Hardy Cross e solver' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(scenario.pipes.length);
    scenario.pipes.forEach((pipe, index) => {
      const solver = evaluation.result.pipes[pipe.id]!.flow;
      expect(hc.flows[pipe.id]!).toBeCloseTo(solver, 6);
      expect(cells(rows[index]!)).toEqual([
        pipe.id,
        pt(hc.initialFlows[pipe.id]! * 1000, 3),
        pt(hc.flows[pipe.id]! * 1000, 3),
        pt(solver * 1000, 3),
        '0,0000',
      ]);
      // Both methods agree to the precision shown.
      expect(cells(rows[index]!)[2]).toBe(cells(rows[index]!)[3]);
    });
    expect(
      screen.getByText('Maior diferença entre os dois métodos: < 0,0001 L/s.'),
    ).toBeInTheDocument();
  });

  it('shows the three loops of stage 4 and the pipes they share', async () => {
    const user = userEvent.setup();
    const { scenario, evaluation } = open('stage4');
    const hc = evaluation.hardyCross!.result;
    render(<HardyCrossTable />);

    expect(hc.converged).toBe(true);
    for (const id of ['I', 'II', 'III']) {
      expect(screen.getByRole('table', { name: `Anel ${id}, Iteração 1` })).toBeInTheDocument();
    }
    const loopOne = within(screen.getByRole('table', { name: 'Anel I, Iteração 1' }));
    expect(loopOne.getByRole('rowheader', { name: /^T9/ })).toHaveTextContent('também no anel II');
    const loopTwo = within(screen.getByRole('table', { name: 'Anel II, Iteração 1' }));
    expect(loopTwo.getByRole('rowheader', { name: /^T9/ })).toHaveTextContent('também no anel I');
    expect(loopTwo.getByRole('rowheader', { name: /^T10/ })).toHaveTextContent(
      'também no anel III',
    );

    // T9 runs with loop I and against loop II: it receives ΔQ_I − ΔQ_II.
    const [one, two] = hc.iterations[0]!.loops;
    const t9 = one!.rows.find((r) => r.pipeId === 'T9')!;
    expect(t9.correctedFlow).toBeCloseTo(t9.flow + one!.deltaQ - two!.deltaQ, 12);

    await user.click(screen.getByRole('button', { name: 'Última iteração' }));
    const last = hc.iterations[hc.iterations.length - 1]!;
    for (const step of last.loops) expect(Math.abs(step.sumHeadLoss)).toBeLessThan(1e-3);
    for (const pipe of scenario.pipes) {
      expect(hc.flows[pipe.id]!).toBeCloseTo(evaluation.result.pipes[pipe.id]!.flow, 6);
    }
  });

  it('selects the pipe of a clicked row', async () => {
    const user = userEvent.setup();
    open('stage3');
    render(<HardyCrossTable />);
    const table = within(screen.getByRole('table', { name: 'Anel I, Iteração 1' }));
    const row = table.getByRole('rowheader', { name: 'T3' }).closest('tr')!;
    await user.click(row);
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T3' });
    expect(row).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the old table with a note when the design changed', () => {
    open('stage3');
    useAppStore.setState({ stale: true });
    render(<HardyCrossTable />);
    expect(screen.getByText(/Valores desatualizados/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Anel I, Iteração 1' })).toBeInTheDocument();
  });

  it('switches to English', () => {
    open('stage3');
    useAppStore.setState({ lang: 'en' });
    render(<HardyCrossTable />);
    expect(screen.getByRole('table', { name: 'Loop I, Iteration 1' })).toBeInTheDocument();
    expect(screen.getByText(/^n = 1\.852 \(Hazen-Williams\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next iteration' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Corrected Q (L/s)' })).toBeInTheDocument();
  });
});
