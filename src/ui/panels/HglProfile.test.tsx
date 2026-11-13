import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Diameters } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { HglProfile } from './HglProfile';

function open(stageId: string, diameters?: Diameters) {
  const scenario = getScenario(stageId)!;
  const used = diameters ?? scenario.reference.diameters;
  const evaluation = evaluateStage(scenario, used);
  useAppStore.setState({ scenario, diameters: used, evaluation, formula: scenario.formula });
  return { scenario, evaluation };
}

const pt = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function dataRows() {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
}

describe('HglProfile', () => {
  beforeEach(() => resetStore());

  it('shows a hint before there is a result', () => {
    useAppStore.setState({ scenario: getScenario('stage2')! });
    render(<HglProfile />);
    expect(screen.getByText(/Ainda não há resultados/)).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('draws the default path of the scenario with a text alternative', () => {
    const { evaluation } = open('stage2');
    render(<HglProfile />);
    expect(screen.getByRole('table', { name: 'Dados do perfil por nó' })).toBeInTheDocument();

    const chart = screen.getByRole('group', { name: 'Perfil longitudinal de R1 a N4' });
    expect(chart).toHaveAccessibleDescription(
      `Caminho R1 → N1 → N2 → N4, 720 m. Menor pressão no caminho: ${pt(
        evaluation.result.nodes.N4!.pressure,
        1,
      )} mca no nó N4.`,
    );
    expect(screen.getByRole('combobox', { name: 'Perfil até o nó' })).toHaveValue('N4');

    const n2 = evaluation.result.nodes.N2!;
    expect(dataRows()).toEqual([
      ['R1', '0', '146,00', '150,00', '4,00', '150,00'],
      [
        'N1',
        '250',
        '128,00',
        pt(evaluation.result.nodes.N1!.head),
        pt(evaluation.result.nodes.N1!.pressure),
        '150,00',
      ],
      ['N2', '500', '118,00', pt(n2.head), pt(n2.pressure), '150,00'],
      [
        'N4',
        '720',
        '132,00',
        pt(evaluation.result.nodes.N4!.head),
        pt(evaluation.result.nodes.N4!.pressure),
        '150,00',
      ],
    ]);
    expect(chart.querySelector('.profile__hgl')).not.toBeNull();
    expect(chart.querySelector('.profile__static')).not.toBeNull();
    expect(chart.querySelector('.profile__min')).not.toBeNull();
    expect(chart.querySelector('.profile__terrain')).not.toBeNull();
    expect(chart.querySelector('.profile__pipe')).not.toBeNull();
  });

  it('has one marker per node of the path with its values', () => {
    const { evaluation } = open('stage2');
    render(<HglProfile />);
    const markers = within(screen.getByRole('group')).getAllByRole('button');
    expect(markers).toHaveLength(4);
    expect(
      screen.getByRole('button', {
        name: new RegExp(
          `^Nó N2 · Distância 500 m · .*Pressão ${pt(evaluation.result.nodes.N2!.pressure)} mca`,
        ),
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reservatório R1/ })).toBeInTheDocument();
  });

  it('recomputes the path when another end node is chosen', async () => {
    const user = userEvent.setup();
    open('stage2');
    render(<HglProfile />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Perfil até o nó' }), 'N6');
    expect(
      screen.getByRole('group', { name: 'Perfil longitudinal de R1 a N6' }),
    ).toBeInTheDocument();
    expect(dataRows().map((row) => [row[0], row[1]])).toEqual([
      ['R1', '0'],
      ['N1', '250'],
      ['N2', '500'],
      ['N3', '760'],
      ['N6', '990'],
    ]);
  });

  it('shows the values of a node on hover and focus and selects it on click', async () => {
    const user = userEvent.setup();
    const { evaluation } = open('stage2');
    render(<HglProfile />);
    // No instructions by default: the readout starts on the node with the lowest pressure.
    expect(screen.queryByText(/Passe o cursor ou toque em um nó/)).not.toBeInTheDocument();
    const lowest = evaluation.network.junctions
      .filter((junction) => ['N1', 'N2', 'N4'].includes(junction.id))
      .reduce((a, b) =>
        evaluation.result.nodes[b.id]!.pressure < evaluation.result.nodes[a.id]!.pressure ? b : a,
      ).id;
    expect(document.querySelector('.profile__readout')).toHaveTextContent(
      new RegExp(`^Nó ${lowest} · Distância`),
    );

    const n1 = screen.getByRole('button', { name: /^Nó N1/ });
    await user.hover(n1);
    const readout = document.querySelector('.profile__readout')!;
    expect(readout).toHaveTextContent(
      `Nó N1 · Distância 250 m · Cota do terreno 128,00 m · Cota piezométrica ${pt(
        evaluation.result.nodes.N1!.head,
      )} m`,
    );
    await user.unhover(n1);
    expect(readout).toHaveTextContent(new RegExp(`^Nó ${lowest} `));

    // The picker, its help, then the first marker.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Reservatório R1/ })).toHaveFocus();
    expect(readout).toHaveTextContent(/^Reservatório R1/);

    await user.click(n1);
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N1' });
    expect(n1).toHaveAttribute('aria-pressed', 'true');

    screen.getByRole('button', { name: /^Nó N4/ }).focus();
    await user.keyboard('{Enter}');
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N4' });
  });

  it('keeps the values of a tapped node in the readout until another one is chosen', async () => {
    const user = userEvent.setup();
    const { evaluation } = open('stage2');
    render(<HglProfile />);
    const readout = screen.getByRole('status');
    expect(readout).toHaveClass('chart__readout', 'profile__readout');
    expect(readout).not.toHaveTextContent(/toque em um nó/);

    // A tap is a click with no hover before it and no blur after it.
    fireEvent.click(screen.getByRole('button', { name: /^Nó N2/ }));
    const n2 = `Nó N2 · Distância 500 m · Cota do terreno 118,00 m · Cota piezométrica ${pt(
      evaluation.result.nodes.N2!.head,
    )} m · Pressão ${pt(evaluation.result.nodes.N2!.pressure)} mca`;
    expect(readout).toHaveTextContent(n2);
    expect(readout.querySelector('.chart__readout-title')).toHaveTextContent('Nó N2');
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N2' });

    // It stays when the focus goes elsewhere.
    await user.click(screen.getByRole('combobox', { name: 'Perfil até o nó' }));
    expect(readout).toHaveTextContent(n2);

    fireEvent.click(screen.getByRole('button', { name: /^Nó N4/ }));
    expect(readout).toHaveTextContent(/^Nó N4 · Distância 720 m/);
  });

  it('shows the values of a node reached with the keyboard', async () => {
    const user = userEvent.setup();
    open('stage2');
    render(<HglProfile />);
    act(() => screen.getByRole('button', { name: /^Nó N1/ }).focus());
    expect(screen.getByRole('status')).toHaveTextContent(/^Nó N1 · Distância 250 m/);
    await user.tab();
    expect(screen.getByRole('status')).toHaveTextContent(/^Nó N2 · Distância 500 m/);
  });

  it('chooses the node closest to a tap on the plot', () => {
    open('stage2');
    render(<HglProfile />);
    const svg = screen.getByRole('group', { name: 'Perfil longitudinal de R1 a N4' });
    // The chart is drawn 720 px wide; here it is shown at half that size.
    svg.getBoundingClientRect = () => new DOMRect(10, 0, 360, 200);
    const plot = svg.querySelector('.profile__plot')!;
    const n1 = svg.querySelectorAll('.profile__node')[1]!.querySelector('.profile__marker')!;
    const at = Number(n1.getAttribute('cx'));

    fireEvent.click(plot, { clientX: 10 + (at + 20) / 2 });
    expect(screen.getByRole('status')).toHaveTextContent(/^Nó N1 /);
    expect(useAppStore.getState().selection).toEqual({ type: 'node', id: 'N1' });

    fireEvent.click(plot, { clientX: 10 + 360 });
    expect(screen.getByRole('status')).toHaveTextContent(/^Nó N4 /);
  });

  it('gives every node a touch target of 44 px', () => {
    open('stage2');
    render(<HglProfile />);
    const hits = [...document.querySelectorAll('.profile__hit')];
    expect(hits).toHaveLength(4);
    for (const hit of hits) expect(Number(hit.getAttribute('r')) * 2).toBeGreaterThanOrEqual(44);
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
      open('stage4');
      const view = render(<HglProfile />);
      const svg = document.querySelector<SVGSVGElement>('svg.chart__svg')!;
      const ticks = [...svg.querySelectorAll('.chart__tick')];
      const result = {
        viewBox: svg.getAttribute('viewBox')!.split(' ').map(Number),
        // Labels under the horizontal axis are centred on their tick.
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

    it('draws at that width and with fewer ticks on a phone', () => {
      const phone = drawAt(310);
      const wide = drawAt(900);
      expect(phone.viewBox[2]).toBe(310);
      expect(wide.viewBox[2]).toBe(900);
      expect(phone.viewBox[3]).toBeLessThan(wide.viewBox[3]!);
      expect(phone.xTicks.length + phone.yTicks.length).toBeLessThan(
        wide.xTicks.length + wide.yTicks.length,
      );
      expect(phone.xTicks.length).toBeGreaterThanOrEqual(2);
      expect(phone.yTicks.length).toBeGreaterThanOrEqual(2);
    });

    it('never lets the tick labels touch', () => {
      for (const width of [280, 310, 358, 398, 786]) {
        const { xTicks, yTicks } = drawAt(width);
        for (let i = 1; i < xTicks.length; i++) {
          // 6.7 px per character at 11 px, centred on the tick.
          const half = (xTicks[i]!.text.length + xTicks[i - 1]!.text.length) * 3.35;
          expect(xTicks[i]!.x - xTicks[i - 1]!.x).toBeGreaterThan(half + 4);
        }
        for (let i = 1; i < yTicks.length; i++) {
          expect(Math.abs(yTicks[i]! - yTicks[i - 1]!)).toBeGreaterThanOrEqual(16);
        }
      }
    });
  });

  it('marks the nodes below the minimum pressure', () => {
    const scenario = getScenario('stage2')!;
    open('stage2', initialDiameters(scenario));
    render(<HglProfile />);
    expect(screen.getByText('3 nós abaixo de 10 mca')).toHaveClass('profile__alert');
    expect(screen.getAllByRole('button', { name: /\(abaixo do mínimo\)/ })).toHaveLength(3);
    expect(document.querySelectorAll('svg .profile__node--below')).toHaveLength(3);
    expect(dataRows()[1]![4]).toMatch(/\(abaixo do mínimo\)$/);
    // The grade line falls far below the ground with the initial diameters: said in the help.
    expect(screen.queryByText(/desce além da escala do gráfico/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda: Perfil' }));
    expect(screen.getByText(/desce além da escala do gráfico/)).toBeInTheDocument();
  });

  it('keeps the instructions, the path, the legend and the terms behind the help', async () => {
    const user = userEvent.setup();
    open('stage2');
    render(<HglProfile />);
    expect(screen.queryByText('Linha piezométrica', { selector: 'li' })).not.toBeInTheDocument();
    expect(document.querySelector('.term')).toBeNull();
    // The path stays as the description of the chart for screen readers.
    expect(screen.getByText(/^Caminho R1 → N1 → N2 → N4, 720 m\./)).toHaveClass('visually-hidden');

    await user.click(screen.getByRole('button', { name: 'Ajuda: Perfil' }));
    const help = within(screen.getByRole('note', { name: 'Ajuda: Perfil' }));
    expect(help.getByText(/^Passe o cursor ou toque em um nó/)).toBeInTheDocument();
    expect(help.getByText(/^Caminho R1 → N1 → N2 → N4, 720 m\./)).toBeInTheDocument();
    for (const entry of [
      'Linha piezométrica',
      'Nível estático',
      'Terreno + 10 mca (pressão mínima)',
      'Terreno',
      'Tubulação',
      'Nó',
      'Nó abaixo da pressão mínima',
    ]) {
      expect(help.getByText(entry, { selector: 'li' })).toBeInTheDocument();
    }
    expect(help.getAllByRole('button')).toHaveLength(3);
  });

  it('shows the pump of stage 5 as a jump at distance zero', () => {
    const { evaluation } = open('stage5');
    render(<HglProfile />);
    const head = evaluation.result.pumps.B1!.head;
    expect(screen.getByText(`Bomba B1: +${pt(head, 1)} m`)).toBeInTheDocument();
    const rows = dataRows();
    expect(rows[0]!.slice(0, 4)).toEqual(['R1', '0', '100,00', '100,00']);
    expect(rows[1]!.slice(0, 4)).toEqual(['J1', '0', '101,00', pt(100 + head)]);
    expect(rows[1]![5]).toBe('150,00');
    expect(rows.map((row) => row[1])).toEqual(['0', '0', '300', '550', '750']);
  });

  it('keeps the old profile with a note when the design changed', () => {
    open('stage2');
    useAppStore.setState({ stale: true });
    render(<HglProfile />);
    expect(screen.getByText(/Valores desatualizados/)).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /Perfil longitudinal/ }).closest('.result-content--stale'),
    ).not.toBeNull();
  });

  it('switches to English', () => {
    open('stage2');
    useAppStore.setState({ lang: 'en' });
    render(<HglProfile />);
    expect(
      screen.getByRole('group', { name: 'Longitudinal profile from R1 to N4' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Profile to node' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Help: Profile' }));
    expect(screen.getByText('Hydraulic grade line', { selector: 'li' })).toBeInTheDocument();
    expect(dataRows()[0]).toEqual(['R1', '0', '146.00', '150.00', '4.00', '150.00']);
  });
});
