import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { CSV_BOM } from '../../game/resultsTable';
import { getScenario } from '../../scenarios';
import type { Diameters } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { GLOSSARY } from '../glossary/glossary';
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
      'Diâmetro nominal (mm)',
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

  it('shows symbols and short words in the headers, with the names in the help', async () => {
    const user = userEvent.setup();
    open('stage2');
    render(<ResultsTable />);
    const table = within(pipeTable());
    const shown = (name: string) => table.getAllByRole('columnheader', { name })[0]!.textContent;
    expect(shown('Extensão (m)')).toBe('L (m)');
    expect(shown('Vazão (L/s)')).toBe('Q (L/s)');
    expect(shown('Velocidade (m/s)')).toBe('V (m/s)');
    expect(shown('Perda unitária J (m/km)')).toBe('J (m/km)');
    expect(shown('Perda de carga (m)')).toBe('hf (m)');
    expect(shown('Cota piezométrica (m)')).toBe('CP (m)');
    expect(shown('Pressão disponível (mca)')).toBe('Pressão (mca)');
    expect(shown('Montante')).toBe('Mont.');
    expect(shown('Jusante')).toBe('Jus.');
    const nodes = within(nodeTable());
    expect(nodes.getByRole('columnheader', { name: 'Pressão estática (mca)' })).toHaveTextContent(
      'Estática (mca)',
    );
    // No glossary terms in the headers, no hint or legend under the tables.
    expect(document.querySelector('thead .term')).toBeNull();
    expect(screen.queryByText(/Clique ou toque em uma linha/)).not.toBeInTheDocument();
    expect(screen.queryByText('fora do limite (impede a aprovação)')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajuda: Tabela' }));
    const help = screen.getByRole('note', { name: 'Ajuda: Tabela' });
    expect(help).toHaveTextContent('Clique ou toque em uma linha para selecionar');
    const terms = [...help.querySelectorAll('dt')].map((term) => term.textContent);
    expect(terms).toEqual([
      'L (m)',
      'Q (L/s)',
      'DN (mm)',
      'V (m/s)',
      'J (m/km)',
      'hf (m)',
      'CP (m)',
      'Cota (m)',
      'Pressão (mca)',
      'Cota (m)',
      'Demanda (L/s)',
      'CP (m)',
      'Pressão (mca)',
      'Estática (mca)',
    ]);
    expect(help).toHaveTextContent(`Perda de carga: ${GLOSSARY.headLoss.definition.pt}`);
    expect(help).toHaveTextContent('Montante (Mont.) e jusante (Jus.) seguem o sentido real');
    // The marks of the cells are explained here.
    expect(within(help).getByText('fora do limite (impede a aprovação)')).toBeInTheDocument();
    expect(within(help).getByText('fora do limite recomendado (aviso)')).toBeInTheDocument();
    expect(within(help).getByText('escoamento contrário ao sentido desenhado')).toBeInTheDocument();
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
    // The mark stays in the cell: an icon with the reason as text.
    expect(row.querySelectorAll('.results__flag svg')).toHaveLength(2);
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

  it('keeps the header row and the first column sticky inside a scrolling frame', () => {
    open('stage2');
    render(<ResultsTable />);

    for (const [table, name] of [
      [pipeTable(), 'Trechos'],
      [nodeTable(), 'Nós'],
    ] as const) {
      const scroller = screen.getByRole('region', { name });
      expect(scroller).toHaveClass('hscroll__scroller');
      expect(scroller.parentElement).toHaveClass('hscroll', 'results__wrap');
      expect(scroller).toContainElement(table);
      // The corner cell and every row header carry the class the sticky rules use.
      const first = [...table.querySelectorAll('tr')].map((row) => row.querySelector('th'));
      expect(first[0]).toHaveClass('sticky-col', 'results__corner');
      for (const cell of first.filter((th) => th?.getAttribute('scope') === 'row')) {
        expect(cell).toHaveClass('sticky-col');
      }
      expect(table.querySelectorAll('tbody .sticky-col')).toHaveLength(
        table.querySelectorAll('tbody tr').length,
      );
      // Numeric cells keep the tabular, right-aligned style.
      for (const cell of table.querySelectorAll('tbody td')) expect(cell).toHaveClass('num');
    }
  });

  it('puts the unit of a header on its own line', () => {
    open('stage2');
    render(<ResultsTable />);
    const header = within(pipeTable()).getByRole('columnheader', { name: 'Velocidade (m/s)' });
    expect(header.querySelector('.results__unit')).toHaveTextContent('(m/s)');
  });

  it('fades the side of the pipe table that has hidden columns', () => {
    open('stage2');
    render(<ResultsTable />);
    const scroller = screen.getByRole('region', { name: 'Trechos' });
    const frame = scroller.parentElement!;
    expect(frame).toHaveAttribute('data-fade-end', 'false');

    const metrics = (values: Record<string, number>) => {
      for (const [name, value] of Object.entries(values)) {
        Object.defineProperty(scroller, name, { configurable: true, value });
      }
    };
    metrics({ clientWidth: 308, scrollWidth: 983, scrollLeft: 0 });
    fireEvent.scroll(scroller);
    expect(frame).toHaveAttribute('data-fade-start', 'false');
    expect(frame).toHaveAttribute('data-fade-end', 'true');
    metrics({ scrollLeft: 675 });
    fireEvent.scroll(scroller);
    expect(frame).toHaveAttribute('data-fade-start', 'true');
    expect(frame).toHaveAttribute('data-fade-end', 'false');
  });

  it('keeps the export button outside the scrolling frame', () => {
    open('stage2');
    render(<ResultsTable />);
    const button = screen.getByRole('button', { name: 'Exportar CSV' });
    expect(button.closest('.hscroll')).toBeNull();
    expect(button.closest('.results__bar')).not.toBeNull();
  });

  it('switches the table shown on phones', async () => {
    const user = userEvent.setup();
    open('stage2');
    const { container } = render(<ResultsTable />);
    const view = container.querySelector('.results')!;
    const group = within(screen.getByRole('group', { name: 'Tabela mostrada' }));
    const pipesButton = group.getByRole('button', { name: 'Trechos' });
    const nodesButton = group.getByRole('button', { name: 'Nós' });
    expect(view).toHaveClass('results--pipes');
    expect(pipesButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(nodesButton);
    expect(view).toHaveClass('results--nodes');
    expect(view).not.toHaveClass('results--pipes');
    expect(nodesButton).toHaveAttribute('aria-pressed', 'true');
    expect(pipesButton).toHaveAttribute('aria-pressed', 'false');
    // The export button belongs to the bar, which stays whichever table is shown.
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  it('says in words what the marks of the selected row mean', async () => {
    const user = userEvent.setup();
    const scenario = getScenario('stage2')!;
    open('stage2', initialDiameters(scenario));
    render(<ResultsTable />);
    expect(document.querySelector('.results__notes')).toBeNull();

    await user.click(within(pipeTable()).getByRole('button', { name: 'T3' }));
    const notes = document.querySelector('.results__notes')!;
    expect(notes).toHaveAttribute('role', 'status');
    expect(notes).toHaveTextContent(/^T3/);
    expect(notes).toHaveTextContent(
      /Pressão disponível \(Jusante\) .* mca: abaixo do mínimo de 10,00 mca/,
    );
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
    expect(within(table).getByRole('columnheader', { name: 'Flow (L/s)' })).toHaveTextContent(
      'Q (L/s)',
    );
    expect(screen.getByRole('button', { name: 'Help: Table' })).toBeInTheDocument();
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
