import { render, screen, within } from '@testing-library/react';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Diameters } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { PumpChart } from './PumpChart';

function open(stageId: string, diameters?: Diameters) {
  const scenario = getScenario(stageId)!;
  const used = diameters ?? scenario.reference.diameters;
  const evaluation = evaluateStage(scenario, used);
  useAppStore.setState({ scenario, diameters: used, evaluation, formula: scenario.formula });
  return { scenario, evaluation };
}

const pt = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function fact(label: string): string {
  return screen.getByText(label).closest('div')!.querySelector('dd')!.textContent ?? '';
}

describe('PumpChart', () => {
  beforeEach(() => resetStore());

  it('shows a hint before there is a result', () => {
    useAppStore.setState({ scenario: getScenario('stage5')! });
    render(<PumpChart />);
    expect(screen.getByText(/Ainda não há resultados/)).toBeInTheDocument();
  });

  it('explains when the network has no pump curve', () => {
    const { evaluation } = open('stage2');
    expect(evaluation.pumpChart).toBeUndefined();
    render(<PumpChart />);
    expect(screen.getByText(/Não há curva de bomba para mostrar/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows a positive margin with the reference diameters of stage 5', () => {
    const { evaluation } = open('stage5');
    const chart = evaluation.pumpChart!;
    const margin = chart.operating.head - chart.requiredHead;
    expect(margin).toBeGreaterThan(0);
    // The operating point is the pump result of the solver.
    expect(chart.operating.flow).toBeCloseTo(evaluation.result.pumps.B1!.flow, 12);
    expect(chart.operating.head).toBeCloseTo(evaluation.result.pumps.B1!.head, 12);
    render(<PumpChart />);

    expect(screen.getByText('A bomba atende')).toBeInTheDocument();
    expect(fact('Vazão na bomba')).toBe('12,00 L/s');
    expect(fact('Altura fornecida pela bomba')).toBe(`${pt(chart.operating.head)} m`);
    expect(fact('Altura necessária nessa vazão')).toBe(`${pt(chart.requiredHead)} m`);
    expect(fact('Folga (fornecida − necessária)')).toBe(`+${pt(margin)} m`);

    const svg = screen.getByRole('img', { name: 'Curva da bomba B1 e curva do sistema' });
    expect(svg).toHaveAccessibleDescription(
      `Na vazão de 12,00 L/s a bomba fornece ${pt(chart.operating.head)} m e a rede precisa de ${pt(
        chart.requiredHead,
      )} m. A folga é de ${pt(margin)} m: a pressão mínima é mantida em todos os nós.`,
    );
    expect(within(svg).getByText(`folga +${pt(margin)} m`)).toBeInTheDocument();
    expect(svg.querySelector('.pump__margin--ok')).not.toBeNull();
    expect(svg.querySelector('.pump__curve')).not.toBeNull();
    expect(svg.querySelector('.pump__system')).not.toBeNull();
    expect(svg.querySelector('.pump__operating')).not.toBeNull();
    expect(svg.querySelector('.pump__required')).not.toBeNull();
    expect(svg.querySelectorAll('.pump__catalogue')).toHaveLength(3);
  });

  it('shows a negative margin with the initial diameters of stage 5', () => {
    const scenario = getScenario('stage5')!;
    const { evaluation } = open('stage5', initialDiameters(scenario));
    const chart = evaluation.pumpChart!;
    const margin = chart.operating.head - chart.requiredHead;
    expect(margin).toBeLessThan(0);
    render(<PumpChart />);

    expect(screen.getByText('A bomba não atende')).toBeInTheDocument();
    expect(fact('Folga (fornecida − necessária)')).toBe(`−${pt(-margin)} m`);
    expect(
      screen.getByText(
        new RegExp(
          `mas a rede precisa de ${pt(chart.requiredHead)} m\\. Faltam ${pt(
            -margin,
          )} m: a bomba não consegue manter a pressão mínima de 10 mca`,
        ),
      ),
    ).toBeInTheDocument();
    const svg = screen.getByRole('img');
    expect(within(svg).getByText(`faltam ${pt(-margin)} m`)).toBeInTheDocument();
    expect(svg.querySelector('.pump__margin--fail')).not.toBeNull();
  });

  it('shows the fitted equation and the catalogue points', () => {
    const { evaluation } = open('stage5');
    const { a, b, c } = evaluation.pumpChart!.curve;
    render(<PumpChart />);
    const equation = screen.getByText(/^H = /);
    expect(equation.textContent).toBe(`H = ${pt(a)} − ${pt(b, 0)}·Q${pt(c, 3)}`);
    expect(equation.querySelector('sup')).toHaveTextContent(pt(c, 3));
    expect(screen.getByText('com Q em m³/s e H em m')).toBeInTheDocument();
    expect(
      screen.getByText('(0,0 L/s; 50,0 m) (10,0 L/s; 44,0 m) (20,0 L/s; 26,0 m)'),
    ).toBeInTheDocument();
  });

  it('gives the curve points as a table for screen readers', () => {
    const { evaluation } = open('stage5');
    const { points } = evaluation.pumpChart!;
    render(<PumpChart />);
    const table = screen.getByRole('table', { name: 'Pontos das curvas da bomba e do sistema' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(points.length);
    expect(
      within(rows[0]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0,00', '50,00', pt(points[0]!.systemHead)]);
    const tenth = points[10]!;
    expect(
      within(rows[10]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([pt(tenth.flow * 1000), pt(tenth.pumpHead), pt(tenth.systemHead)]);
  });

  it('keeps the old chart with a note when the design changed', () => {
    open('stage5');
    useAppStore.setState({ stale: true });
    render(<PumpChart />);
    expect(screen.getByText(/Valores desatualizados/)).toBeInTheDocument();
    expect(screen.getByRole('img').closest('.result-content--stale')).not.toBeNull();
  });

  it('switches to English', () => {
    open('stage5');
    useAppStore.setState({ lang: 'en' });
    render(<PumpChart />);
    expect(screen.getByText('The pump is sufficient')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Curve of pump B1 and system curve' }),
    ).toBeInTheDocument();
    expect(fact('Flow through the pump')).toBe('12.00 L/s');
    expect(screen.getByText('with Q in m³/s and H in m')).toBeInTheDocument();
  });
});
