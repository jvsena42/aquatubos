import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { CSV_BOM } from '../../game/resultsTable';
import { getScenario } from '../../scenarios';
import type { Diameters } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { ResultsTable } from './ResultsTable';

function open(stageId: string, diameters?: Diameters) {
  const scenario = getScenario(stageId)!;
  const used = diameters ?? scenario.reference.diameters;
  const evaluation = evaluateStage(scenario, used);
  useAppStore.setState({ scenario, diameters: used, evaluation, formula: scenario.formula });
  return { scenario, evaluation };
}

function pipeTable() {
  return screen.getByRole('table', { name: /Planilha de cálculo por trecho/ });
}

function nodeTable() {
  return screen.getByRole('table', { name: /Cotas e pressões por nó/ });
}

describe('ResultsTable', () => {
  beforeEach(() => resetStore());

  it('shows a hint before there is a result', () => {
    useAppStore.setState({ scenario: getScenario('stage2')! });
    render(<ResultsTable />);
    expect(screen.getByText(/Ainda não há resultados/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says it is calculating while the first solve runs', () => {
    useAppStore.setState({ scenario: getScenario('stage2')!, solving: true });
    render(<ResultsTable />);
    expect(screen.getByText('Calculando…')).toBeInTheDocument();
  });

  it('lists one row per pipe with the solver values formatted in pt-BR', () => {
    const { scenario, evaluation } = open('stage2');
    render(<ResultsTable />);

    const rows = within(pipeTable()).getAllByRole('row').slice(2);
    expect(rows).toHaveLength(scenario.pipes.length);
    const pt = (value: number, digits: number) =>
      value.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    const t3 = within(rows[2]!);
    const cells = t3.getAllByRole('cell').map((cell) => cell.textContent);
    const result = evaluation.result.pipes.T3!;
    const n2 = evaluation.result.nodes.N2!;
    const n3 = evaluation.result.nodes.N3!;
    expect(t3.getByRole('rowheader')).toHaveTextContent('T3');
    expect(cells).toEqual([
      'N2',
      'N3',
      '260,0',
      '4,000',
      '75',
      pt(result.velocity, 2),
      pt(result.unitHeadLoss * 1000, 2),
      pt(result.headLoss, 2),
      pt(n2.head, 2),
      pt(n3.head, 2),
      '118,00',
      '111,00',
      pt(n2.pressure, 2),
      pt(n3.pressure, 2),
    ]);
  });

  it('has headers with units', () => {
    open('stage2');
    render(<ResultsTable />);
    const table = within(pipeTable());
    for (const name of [
      'Trecho',
      'Extensão (m)',
      'Vazão (L/s)',
      'DN (mm)',
      'Velocidade (m/s)',
      'Perda unitária J (m/km)',
      'Perda de carga (m)',
      'Cota piezométrica (m)',
      'Cota do terreno (m)',
      'Pressão disponível (mca)',
    ]) {
      expect(table.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(table.getAllByRole('columnheader', { name: 'Montante' })).toHaveLength(4);
    expect(table.getAllByRole('columnheader', { name: 'Jusante' })).toHaveLength(4);
  });

  it('shows the node table with demand, grade and both pressures', () => {
    const { evaluation } = open('stage5');
    render(<ResultsTable />);
    const rows = within(nodeTable()).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'R1reservatório',
      'J1',
      'N2',
      'N3',
      'N4',
      'N5',
      'N6',
    ]);
    const n4 = within(rows[4]!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(n4).toEqual([
      '128,00',
      '2,00',
      evaluation.result.nodes.N4!.head.toFixed(2).replace('.', ','),
      evaluation.result.nodes.N4!.pressure.toFixed(2).replace('.', ','),
      '22,00',
    ]);
  });

  it('swaps upstream and downstream when the flow is negative', () => {
    const { evaluation } = open('stage4', {
      T1: 150,
      T2: 50,
      T3: 50,
      T4: 50,
      T5: 150,
      T6: 150,
      T7: 150,
      T8: 150,
      T9: 50,
      T10: 50,
      T11: 100,
    });
    expect(evaluation.result.pipes.T11!.flow).toBeLessThan(0);
    render(<ResultsTable />);
    const row = within(pipeTable()).getByRole('rowheader', { name: /^T11/ }).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('N8');
    expect(cells[1]).toHaveTextContent('N4');
    expect(cells[3]!.textContent).not.toMatch(/-|−/);
    expect(within(row).getByText(/a água escoa de N8 para N4/)).toBeInTheDocument();
  });

  it('marks values outside the limits with text, not only colour', () => {
    const scenario = getScenario('stage2')!;
    open('stage2', initialDiameters(scenario));
    render(<ResultsTable />);
    const row = within(pipeTable()).getByRole('rowheader', { name: 'T3' }).closest('tr')!;
    expect(within(row).getAllByText('Erro: abaixo do mínimo de 10,00 mca')).toHaveLength(2);
    expect(within(pipeTable()).getAllByText(/Erro: acima do máximo de 3,50 m\/s/)).not.toHaveLength(
      0,
    );
    expect(screen.getByText('fora do limite (impede a aprovação)')).toBeInTheDocument();
  });

  it('does not mark anything in a passing design without warnings', () => {
    open('stage1');
    render(<ResultsTable />);
    expect(screen.queryByText(/abaixo do mínimo|acima do máximo/)).not.toBeInTheDocument();
  });

  it('selects the pipe or node of the clicked row and highlights it', async () => {
    const user = userEvent.setup();
    open('stage2');
    render(<ResultsTable />);

    const t2 = within(pipeTable()).getByRole('rowheader', { name: 'T2' }).closest('tr')!;
    expect(t2).toHaveAttribute('aria-selected', 'false');
    await user.click(within(t2).getAllByRole('cell')[4]!);
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
    expect(t2).toHaveAttribute('aria-selected', 'true');

    await user.click(within(nodeTable()).getByRole('button', { name: 'N4' }));
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N4' });
    expect(t2).toHaveAttribute('aria-selected', 'false');
    expect(
      within(nodeTable()).getByRole('rowheader', { name: 'N4' }).closest('tr'),
    ).toHaveAttribute('aria-selected', 'true');

    await user.click(within(nodeTable()).getByRole('button', { name: 'R1' }));
    expect(useAppStore.getState().selection).toEqual({ type: 'reservoir', id: 'R1' });
  });

  it('highlights the row of an element selected elsewhere', () => {
    open('stage2');
    useAppStore.setState({ selection: { type: 'pipe', id: 'T5' } });
    render(<ResultsTable />);
    expect(
      within(pipeTable()).getByRole('rowheader', { name: 'T5' }).closest('tr'),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the old values with a note when the design changed', () => {
    open('stage2');
    useAppStore.setState({ stale: true });
    render(<ResultsTable />);
    expect(screen.getByText(/Valores desatualizados/)).toBeInTheDocument();
    expect(within(pipeTable()).getAllByRole('row')).toHaveLength(8);
    expect(pipeTable().closest('.result-content--stale')).not.toBeNull();
  });

  it('switches to English', () => {
    open('stage2');
    useAppStore.setState({ lang: 'en' });
    render(<ResultsTable />);
    const table = screen.getByRole('table', { name: /Calculation sheet by pipe/ });
    expect(within(table).getByRole('columnheader', { name: 'Flow (L/s)' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('10.500');
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  describe('CSV export', () => {
    let blobs: Blob[];
    let downloads: string[];

    beforeEach(() => {
      blobs = [];
      downloads = [];
      Object.assign(URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          blobs.push(blob);
          return 'blob:csv';
        }),
        revokeObjectURL: vi.fn(),
      });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download);
      });
    });

    afterEach(() => vi.restoreAllMocks());

    it('downloads the pipe table named after the stage, in the current language', async () => {
      const user = userEvent.setup();
      open('stage3');
      render(<ResultsTable />);

      await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
      expect(downloads).toEqual(['aquatubos-stage3.csv']);
      expect(blobs[0]!.type).toBe('text/csv;charset=utf-8');
      const bytes = new Uint8Array(await blobs[0]!.arrayBuffer());
      expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const pt = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
      expect(pt.startsWith(`${CSV_BOM}Trecho;Nó montante;Nó jusante;Extensão (m)`)).toBe(true);
      expect(pt).toContain('\r\nT1;R1;A;250,0;10,500;100;');

      act(() => useAppStore.setState({ lang: 'en' }));
      await user.click(screen.getByRole('button', { name: 'Export CSV' }));
      const en = await blobs[1]!.text();
      expect(en).toContain('\r\nT1,R1,A,250.0,10.500,100,');
    });
  });
});
