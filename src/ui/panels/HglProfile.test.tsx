import { render, screen, within } from '@testing-library/react';
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
    expect(screen.getByText(/Passe o cursor ou toque em um nó/)).toBeInTheDocument();

    const n1 = screen.getByRole('button', { name: /^Nó N1/ });
    await user.hover(n1);
    const readout = document.querySelector('.profile__readout')!;
    expect(readout).toHaveTextContent(
      `Nó N1 · Distância 250 m · Cota do terreno 128,00 m · Cota piezométrica ${pt(
        evaluation.result.nodes.N1!.head,
      )} m`,
    );
    await user.unhover(n1);
    expect(readout).toHaveTextContent(/Passe o cursor/);

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

  it('marks the nodes below the minimum pressure', () => {
    const scenario = getScenario('stage2')!;
    open('stage2', initialDiameters(scenario));
    render(<HglProfile />);
    expect(
      screen.getByText('3 nós do caminho estão abaixo do mínimo de 10 mca.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /\(abaixo do mínimo\)/ })).toHaveLength(3);
    expect(document.querySelectorAll('svg .profile__node--below')).toHaveLength(3);
    expect(dataRows()[1]![4]).toMatch(/\(abaixo do mínimo\)$/);
    // The grade line falls far below the ground with the initial diameters.
    expect(screen.getByText(/desce além da escala do gráfico/)).toBeInTheDocument();
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
    expect(screen.getByText('Hydraulic grade line', { selector: 'li' })).toBeInTheDocument();
    expect(dataRows()[0]).toEqual(['R1', '0', '146.00', '150.00', '4.00', '150.00']);
  });
});
