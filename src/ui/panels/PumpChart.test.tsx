import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  describe('reader of the curves', () => {
    function reader() {
      const slider = screen.getByRole('slider', { name: 'Vazão de leitura das curvas' });
      // The reader covers the plot area: 300 px here, whatever the size of the chart.
      slider.getBoundingClientRect = () => new DOMRect(50, 0, 300, 200);
      return slider;
    }

    it('starts with a hint in a persistent readout', () => {
      open('stage5');
      render(<PumpChart />);
      const readout = screen.getByRole('status');
      expect(readout).toHaveClass('chart__readout', 'pump__readout');
      expect(readout).toHaveTextContent(/Toque no gráfico/);
      expect(document.querySelector('.pump__read')).toBeNull();
    });

    it('shows both curves at the flow that was tapped', () => {
      const { evaluation } = open('stage5');
      const { points } = evaluation.pumpChart!;
      render(<PumpChart />);
      const slider = reader();

      // The right edge of the plot is the last sample of the curves.
      fireEvent.click(slider, { clientX: 350 });
      const last = points[points.length - 1]!;
      const text = `Vazão ${pt(last.flow * 1000)} L/s · Bomba ${pt(last.pumpHead)} m · Sistema ${pt(
        last.systemHead,
      )} m`;
      expect(screen.getByRole('status')).toHaveTextContent(text);
      expect(slider).toHaveAttribute('aria-valuetext', text);
      expect(document.querySelector('.pump__read line')).not.toBeNull();

      // The left edge is zero flow: the shutoff head of the pump.
      fireEvent.pointerDown(slider, { clientX: 50 });
      expect(screen.getByRole('status')).toHaveTextContent(
        `Vazão 0,00 L/s · Bomba ${pt(points[0]!.pumpHead)} m`,
      );
    });

    it('reads the operating point when the tap lands on it', () => {
      const { evaluation } = open('stage5');
      const chart = evaluation.pumpChart!;
      render(<PumpChart />);
      const slider = reader();
      const maxFlow = chart.points[chart.points.length - 1]!.flow;

      fireEvent.click(slider, { clientX: 50 + (chart.operating.flow / maxFlow) * 300 + 3 });
      expect(screen.getByRole('status')).toHaveTextContent(
        `Vazão 12,00 L/s · Bomba ${pt(chart.operating.head)} m · Sistema ${pt(
          chart.requiredHead,
        )} m · Ponto de operação`,
      );
    });

    it('moves with the keyboard, starting at the operating point', async () => {
      const user = userEvent.setup();
      const { evaluation } = open('stage5');
      const { points } = evaluation.pumpChart!;
      render(<PumpChart />);
      const slider = reader();
      const readout = screen.getByRole('status');

      slider.focus();
      expect(slider).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(readout).toHaveTextContent(/^Vazão 12,00 L\/s .* Ponto de operação$/);

      await user.keyboard('{ArrowRight}');
      const next = points.find((point) => point.flow * 1000 > 12)!;
      expect(readout).toHaveTextContent(`Vazão ${pt(next.flow * 1000)} L/s`);
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      const before = [...points].reverse().find((point) => point.flow * 1000 < 12)!;
      expect(readout).toHaveTextContent(`Vazão ${pt(before.flow * 1000)} L/s`);

      await user.keyboard('{Home}');
      expect(readout).toHaveTextContent(/^Vazão 0,00 L\/s/);
      await user.keyboard('{End}');
      expect(readout).toHaveTextContent(`Vazão ${pt(points[points.length - 1]!.flow * 1000)} L/s`);
      expect(slider).toHaveAttribute(
        'aria-valuenow',
        String(Number((points[points.length - 1]!.flow * 1000).toFixed(2))),
      );
    });
  });

  describe('at the width of the container', () => {
    const drawAt = (width: number) => {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          private readonly callback: (entries: { contentRect: { width: number } }[]) => void;
          constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
            this.callback = callback;
          }
          observe() {
            this.callback([{ contentRect: { width } }]);
          }
          disconnect() {}
        },
      );
      open('stage5');
      const view = render(<PumpChart />);
      const svg = screen.getByRole('img');
      const ticks = [...svg.querySelectorAll('.chart__tick')];
      const result = {
        viewBox: svg.getAttribute('viewBox')!.split(' ').map(Number),
        xTicks: ticks
          .filter((tick) => tick.getAttribute('text-anchor') === 'middle')
          .map((tick) => ({ x: Number(tick.getAttribute('x')), text: tick.textContent ?? '' })),
        yTicks: ticks
          .filter((tick) => tick.getAttribute('text-anchor') === 'end')
          .map((tick) => Number(tick.getAttribute('y'))),
      };
      view.unmount();
      return result;
    };

    afterEach(() => vi.unstubAllGlobals());

    it('draws at that width and with fewer ticks on a narrow chart', () => {
      const narrow = drawAt(280);
      const wide = drawAt(900);
      expect(narrow.viewBox[2]).toBe(280);
      expect(wide.viewBox[2]).toBe(900);
      expect(narrow.viewBox[3]).toBeLessThan(wide.viewBox[3]!);
      expect(narrow.xTicks.length).toBeLessThan(wide.xTicks.length);
      expect(narrow.xTicks.length).toBeGreaterThanOrEqual(2);
    });

    it('never lets the tick labels touch', () => {
      for (const width of [280, 310, 358, 398, 786]) {
        const { xTicks, yTicks } = drawAt(width);
        for (let i = 1; i < xTicks.length; i++) {
          const half = (xTicks[i]!.text.length + xTicks[i - 1]!.text.length) * 3.35;
          expect(xTicks[i]!.x - xTicks[i - 1]!.x).toBeGreaterThan(half + 4);
        }
        for (let i = 1; i < yTicks.length; i++) {
          expect(Math.abs(yTicks[i]! - yTicks[i - 1]!)).toBeGreaterThanOrEqual(16);
        }
      }
    });
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
