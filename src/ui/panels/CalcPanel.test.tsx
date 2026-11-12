import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { networkCost, pipeCost } from '../../engine/cost';
import { darcyWeisbachHeadLoss, hazenWilliamsUnitLoss } from '../../engine/headloss';
import { pumpHead } from '../../engine/pump';
import type { HeadLossFormula } from '../../engine/types';
import { pipeArea, WATER_KINEMATIC_VISCOSITY } from '../../engine/units';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import type { Diameters, Scenario } from '../../scenarios/types';
import { useAppStore, type Selection } from '../../state/store';
import { resetStore } from '../../test/store';
import { CalcPanel } from './CalcPanel';

vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

/** In stage 3 these diameters make the water run from C to B in T3 (defined as B → C). */
const REVERSING: Diameters = { T1: 100, T2: 50, T3: 50, T4: 150, T5: 150 };
const NBSP = String.fromCharCode(0xa0);
const THIN = ' ';

function stage(id: string): Scenario {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`missing ${id}`);
  return scenario;
}

function openStage(
  id: string,
  selection: Selection,
  diameters?: Diameters,
  formula?: HeadLossFormula,
) {
  const scenario = stage(id);
  const design = diameters ?? scenario.reference.diameters;
  const evaluation = evaluateStage(scenario, design, formula ?? scenario.formula);
  useAppStore.setState({
    scenario,
    diameters: design,
    formula: formula ?? scenario.formula,
    evaluation,
    selection,
  });
  return { scenario, evaluation };
}

/** Number as the panel prints it in pt: comma, fixed decimals, real minus sign. */
const pt = (value: number, digits = 2) =>
  value
    .toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace('-', '−');

/** Significant figures as the panel prints them (thousands split by a thin space). */
const sig = (value: number, figures = 4) =>
  pt(value, Math.max(0, figures - 1 - Math.floor(Math.log10(Math.abs(value))))).replace(
    /\./g,
    THIN,
  );

const value = (name: string): string => {
  const found = document.querySelector(`[data-value="${name}"]`);
  if (!found) throw new Error(`no value ${name}`);
  return found.textContent ?? '';
};

/** Reads a printed pt number back. */
const parse = (text: string): number =>
  Number(
    text
      .replace(/[^\d,−-]/g, '')
      .replace('−', '-')
      .replace(',', '.'),
  );

describe('CalcPanel', () => {
  beforeEach(() => resetStore());

  it('shows a hint and the network summary when nothing is selected', () => {
    const { scenario } = openStage('stage3', null);
    render(<CalcPanel />);
    expect(screen.getByText(/Selecione um trecho ou um nó/)).toBeInTheDocument();
    expect(value('total-demand')).toBe('10,50 L/s');
    expect(value('pipe-count')).toBe('5');
    expect(value('total-length')).toBe('1.780 m');
    const cost = networkCost(
      scenario.pipes.map((p) => ({ dn: scenario.reference.diameters[p.id]!, length: p.length })),
    );
    expect(cost).toBe(scenario.reference.cost);
    expect(value('total-cost')).toBe(`R$${NBSP}${pt(cost)}`);
  });

  describe('pipe, Hazen-Williams', () => {
    it.each(['T1', 'T2', 'T3', 'T4', 'T5'])('prints the numbers of the solver for %s', (id) => {
      const { evaluation } = openStage('stage3', { type: 'pipe', id });
      render(<CalcPanel />);
      const pipe = evaluation.network.pipes.find((p) => p.id === id)!;
      const result = evaluation.result.pipes[id]!;
      const flow = Math.abs(result.flow);

      expect(value('q')).toBe(`${pt(flow * 1000)} L/s`);
      expect(value('area')).toBe(`${sig(pipeArea(pipe.diameter))} m²`);
      expect(value('v')).toBe(`${pt(Math.abs(result.velocity), 3)} m/s`);
      expect(value('hf')).toBe(`${pt(Math.abs(result.headLoss), 3)} m`);
      expect(value('j')).toBe(`${sig(result.unitHeadLoss)} m/m`);

      // The J on screen is the Hazen-Williams formula evaluated with the numbers on screen.
      const byFormula = hazenWilliamsUnitLoss(flow, pipe.hazenWilliamsC, pipe.diameter);
      expect(value('j')).toBe(`${sig(byFormula)} m/m`);
      expect(byFormula * pipe.length).toBeCloseTo(Math.abs(result.headLoss), 9);

      // Energy line: downstream grade = upstream grade − hf, with the heads of the result.
      const up = evaluation.result.nodes[pipe.from]!.head;
      const down = evaluation.result.nodes[pipe.to]!.head;
      expect(value('hgl-down')).toBe(`${pt(down)} m`);
      expect(up - Math.abs(result.headLoss)).toBeCloseTo(down, 6);
      expect(parse(value('hgl-down'))).toBeCloseTo(up - parse(value('hf')), 1);
    });

    it('writes the formula with the substituted numbers', () => {
      const { evaluation } = openStage('stage3', { type: 'pipe', id: 'T1' });
      render(<CalcPanel />);
      const q = pt(evaluation.result.pipes.T1!.flow, 5);
      const steps = screen.getByRole('list');
      expect(steps).toHaveTextContent('J = 10,643 × Q1,852 / (C1,852 × D4,87)');
      expect(steps).toHaveTextContent(`J = 10,643 × ${q}1,852 / (1401,852 × 0,1004,87)`);
      expect(steps).toHaveTextContent(`Q = 10,50 L/s = ${q} m³/s`);
      expect(steps).toHaveTextContent('A = π × D2 / 4 = π × 0,1002 / 4');
      expect(steps).toHaveTextContent(
        `hf = J × L = ${sig(evaluation.result.pipes.T1!.unitHeadLoss)} × 250`,
      );
      expect(steps).toHaveTextContent('CPA = CPR1 − hf = 128,00 −');
      expect(steps.querySelectorAll('sup').length).toBeGreaterThan(5);
      expect(screen.getByText('Escoamento de R1 para A.')).toBeInTheDocument();
    });

    it('shows the velocity against the limits and the cost of the pipe', () => {
      const { evaluation } = openStage('stage3', { type: 'pipe', id: 'T1' });
      render(<CalcPanel />);
      const speed = Math.abs(evaluation.result.pipes.T1!.velocity);
      expect(speed).toBeGreaterThan(NBR_CHECK_LIMITS.minVelocity);
      expect(speed).toBeLessThan(NBR_CHECK_LIMITS.maxVelocity);
      expect(screen.getByText('Atende (0,6 a 3,5 m/s)')).toBeInTheDocument();
      expect(value('cost')).toBe(`R$${NBSP}${pt(pipeCost(100, 250))}`);
      expect(screen.getByText(/R\$\s65,00\/m × 250 m =/)).toBeInTheDocument();
    });

    it('flags a velocity above the maximum', () => {
      const scenario = stage('stage4');
      const { evaluation } = openStage(
        'stage4',
        { type: 'pipe', id: 'T2' },
        initialDiameters(scenario),
      );
      expect(Math.abs(evaluation.result.pipes.T2!.velocity)).toBeGreaterThan(
        NBR_CHECK_LIMITS.maxVelocity,
      );
      render(<CalcPanel />);
      expect(screen.getByText('Acima do máximo de 3,5 m/s')).toBeInTheDocument();
    });

    it('follows the real direction when the flow is negative', () => {
      const { evaluation } = openStage('stage3', { type: 'pipe', id: 'T3' }, REVERSING);
      const result = evaluation.result.pipes.T3!;
      expect(result.flow).toBeLessThan(0);
      render(<CalcPanel />);
      expect(screen.getByText(/Escoamento de C para B, contrário ao sentido/)).toBeInTheDocument();
      expect(value('q')).toBe(`${pt(Math.abs(result.flow) * 1000)} L/s`);
      expect(value('hf')).toBe(`${pt(Math.abs(result.headLoss), 3)} m`);
      expect(value('hgl-down')).toBe(`${pt(evaluation.result.nodes.B!.head)} m`);
      expect(screen.getByRole('list')).toHaveTextContent(
        `CPB = CPC − hf = ${pt(evaluation.result.nodes.C!.head)} −`,
      );
    });
  });

  describe('pipe, Darcy-Weisbach', () => {
    it.each(['T1', 'T3', 'T5'])('prints the numbers of the solver for %s', (id) => {
      const { evaluation } = openStage('stage3', { type: 'pipe', id }, undefined, 'darcy-weisbach');
      render(<CalcPanel />);
      const pipe = evaluation.network.pipes.find((p) => p.id === id)!;
      const result = evaluation.result.pipes[id]!;
      expect(evaluation.result.formula).toBe('darcy-weisbach');
      expect(result.frictionFactor).toBeGreaterThan(0);

      expect(value('re')).toBe(pt(result.reynolds!, 0).replace(/\./g, THIN));
      expect(value('rr')).toBe(sig(pipe.roughness / pipe.diameter, 3));
      expect(value('f')).toBe(pt(result.frictionFactor!, 4));
      expect(value('hf')).toBe(`${pt(Math.abs(result.headLoss), 3)} m`);
      expect(value('j')).toBe(`${sig(result.unitHeadLoss)} m/m`);

      // hf on screen is f × (L/D) × V²/(2g) of the engine for the flow on screen.
      const byFormula = darcyWeisbachHeadLoss(
        result.flow,
        pipe.diameter,
        pipe.length,
        pipe.roughness,
        WATER_KINEMATIC_VISCOSITY,
      );
      expect(value('hf')).toBe(`${pt(Math.abs(byFormula), 3)} m`);
      expect(value('hgl-down')).toBe(`${pt(evaluation.result.nodes[pipe.to]!.head)} m`);
    });

    it('writes Reynolds, the friction factor and the Darcy-Weisbach formula', () => {
      const { evaluation } = openStage(
        'stage3',
        { type: 'pipe', id: 'T1' },
        undefined,
        'darcy-weisbach',
      );
      render(<CalcPanel />);
      const result = evaluation.result.pipes.T1!;
      const steps = screen.getByRole('list');
      const v = pt(Math.abs(result.velocity), 3);
      const f = pt(result.frictionFactor!, 4);
      expect(steps).toHaveTextContent(`Re = V × D / ν = ${v} × 0,100 / (1,004 × 10−6)`);
      expect(steps).toHaveTextContent('ε / D = 0,0015 mm / 100 mm');
      expect(steps).toHaveTextContent('hf = f × (L / D) × V2 / (2g)');
      expect(steps).toHaveTextContent(`hf = ${f} × (250 / 0,100) × ${v}2 / (2 × 9,80665)`);
      expect(steps).toHaveTextContent('Colebrook-White');
      expect(steps).not.toHaveTextContent('10,643');
      expect(screen.getByText('ε = 0,0015 mm')).toBeInTheDocument();
    });
  });

  describe('diameter picker', () => {
    it('writes the diameter to the store and asks for a new calculation', async () => {
      const user = userEvent.setup();
      openStage('stage3', { type: 'pipe', id: 'T2' });
      render(<CalcPanel />);
      const picker = within(screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' }));
      expect(picker.getAllByRole('button')).toHaveLength(7);
      expect(picker.getByRole('button', { name: /^DN 75,/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(picker.getByRole('button', { name: /^DN 150,/ })).toHaveTextContent(/150R\$\s120\/m/);

      await user.click(picker.getByRole('button', { name: /^DN 150,/ }));
      expect(useAppStore.getState().diameters.T2).toBe(150);
      expect(useAppStore.getState().stale).toBe(true);
      expect(picker.getByRole('button', { name: /^DN 150,/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // Geometry and cost follow the new DN; the old calculation is not shown.
      expect(value('cost')).toBe(`R$${NBSP}${pt(pipeCost(150, 350))}`);
      expect(document.querySelector('[data-value="hf"]')).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Os resultados precisam ser recalculados',
      );
    });

    it('says that a fixed pipe cannot change', () => {
      const { scenario } = openStage('stage3', { type: 'pipe', id: 'T1' });
      useAppStore.setState({
        scenario: {
          ...scenario,
          pipes: scenario.pipes.map((p) => (p.id === 'T1' ? { ...p, fixed: true } : p)),
        },
      });
      render(<CalcPanel />);
      for (const button of within(
        screen.getByRole('group', { name: 'Diâmetro nominal do trecho T1' }),
      ).getAllByRole('button')) {
        expect(button).toBeDisabled();
      }
      expect(screen.getByText(/é fixo nesta etapa e não pode ser alterado/)).toBeInTheDocument();
    });
  });

  it('shows geometry and asks for a calculation before the first solve', () => {
    const scenario = stage('stage3');
    useAppStore.setState({
      scenario,
      diameters: initialDiameters(scenario),
      selection: { type: 'pipe', id: 'T1' },
    });
    render(<CalcPanel />);
    expect(screen.getByRole('heading', { name: 'Trecho T1' })).toBeInTheDocument();
    expect(screen.getByText('L = 250 m')).toBeInTheDocument();
    expect(screen.getByText('C = 140')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Os resultados precisam ser recalculados');
    expect(document.querySelector('[data-value="hf"]')).toBeNull();
  });

  describe('node', () => {
    it('writes the energy balance with the numbers of the solver', () => {
      const { evaluation } = openStage('stage3', { type: 'node', id: 'C' });
      render(<CalcPanel />);
      const node = evaluation.result.nodes.C!;
      expect(value('hgl')).toBe(`${pt(node.head)} m`);
      expect(value('pressure')).toBe(`${pt(node.pressure)} mca`);
      expect(node.head - node.elevation).toBeCloseTo(node.pressure, 9);
      expect(screen.getByText('pressão = cota piezométrica − cota do terreno')).toBeInTheDocument();
      expect(screen.getByRole('list')).toHaveTextContent(
        `p = CP − z = ${pt(node.head)} − 100,00 = ${pt(node.pressure)} mca`,
      );
      expect(screen.getByText('Atende (mín. 10 mca)')).toBeInTheDocument();

      const atRest = evaluation.report.staticPressure.C!;
      expect(atRest).toBeCloseTo(28, 9);
      expect(value('static')).toBe('28,00 mca');
      expect(screen.getByRole('list')).toHaveTextContent('pest = 128,00 − 100,00 = 28,00 mca');
      expect(screen.getByText('Atende (máx. 40 mca)')).toBeInTheDocument();
    });

    it('checks continuity with the connected pipes', () => {
      const { evaluation } = openStage('stage3', { type: 'node', id: 'A' });
      render(<CalcPanel />);
      const flows = evaluation.result.pipes;
      const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
      expect(rows.map((row) => row.textContent)).toEqual([
        `T1entra, de R1${pt(flows.T1!.flow * 1000)}`,
        `T2sai, para B${pt(flows.T2!.flow * 1000)}`,
        `T4sai, para D${pt(flows.T4!.flow * 1000)}`,
      ]);
      expect(flows.T1!.flow - flows.T2!.flow - flows.T4!.flow).toBeCloseTo(0.001, 9);
      expect(value('continuity')).toBe('0,00 L/s');
      expect(screen.getByRole('list')).toHaveTextContent(
        `${pt(flows.T1!.flow * 1000)} − ${pt((flows.T2!.flow + flows.T4!.flow) * 1000)} − 1,00 = 0,00 L/s`,
      );
    });

    it('lists a reversed pipe as inflow at its start node', () => {
      const { evaluation } = openStage('stage3', { type: 'node', id: 'B' }, REVERSING);
      render(<CalcPanel />);
      expect(within(screen.getByRole('table')).getByRole('row', { name: /T3/ })).toHaveTextContent(
        `T3entra, de C${pt(Math.abs(evaluation.result.pipes.T3!.flow) * 1000)}`,
      );
      expect(value('continuity')).toBe('0,00 L/s');
    });

    it('flags a pressure below the minimum', () => {
      const scenario = stage('stage3');
      const { evaluation } = openStage(
        'stage3',
        { type: 'node', id: 'C' },
        initialDiameters(scenario),
      );
      expect(evaluation.result.nodes.C!.pressure).toBeLessThan(NBR_CHECK_LIMITS.minDynamicPressure);
      render(<CalcPanel />);
      expect(screen.getByText('Abaixo do mínimo de 10 mca')).toBeInTheDocument();
      expect(value('pressure')).toBe(`${pt(evaluation.result.nodes.C!.pressure)} mca`);
      expect(value('pressure')).toMatch(/^−/);
    });

    it('keeps the static pressure and hides the rest while the results are outdated', () => {
      openStage('stage3', { type: 'node', id: 'C' });
      useAppStore.setState({ stale: true });
      render(<CalcPanel />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'Os resultados precisam ser recalculados',
      );
      expect(document.querySelector('[data-value="pressure"]')).toBeNull();
      expect(document.querySelector('[data-value="continuity"]')).toBeNull();
      expect(value('static')).toBe('28,00 mca');
      expect(screen.getByText('4,00 L/s')).toBeInTheDocument();
    });

    it('says that a pump discharge node without demand is not checked', () => {
      openStage('stage5', { type: 'node', id: 'J1' });
      render(<CalcPanel />);
      expect(screen.getByText(/Nó de recalque sem consumo/)).toBeInTheDocument();
      expect(screen.queryByText(/Atende|Abaixo do mínimo|Acima do máximo/)).not.toBeInTheDocument();
      expect(value('continuity')).toBe('0,00 L/s');
    });
  });

  it('shows the water level and the flow supplied by a reservoir', () => {
    const { evaluation } = openStage('stage3', { type: 'reservoir', id: 'R1' });
    render(<CalcPanel />);
    expect(screen.getByRole('heading', { name: 'Reservatório R1' })).toBeInTheDocument();
    expect(value('level')).toBe('128,00 m');
    expect(value('outflow')).toBe('10,50 L/s');
    expect(evaluation.result.nodes.R1!.demand).toBeCloseTo(0.0105, 9);
    expect(within(screen.getByRole('table')).getByRole('row', { name: /T1/ })).toHaveTextContent(
      'T1sai, para A10,50',
    );
  });

  it('opens the reservoir panel when another panel selects it as a node', () => {
    openStage('stage3', { type: 'node', id: 'R1' });
    render(<CalcPanel />);
    expect(screen.getByRole('heading', { name: 'Reservatório R1' })).toBeInTheDocument();
  });

  it('shows the pump curve and its operating point', () => {
    const { evaluation } = openStage('stage5', { type: 'pump', id: 'B1' });
    render(<CalcPanel />);
    const curve = evaluation.network.pumps[0]!.curve;
    const result = evaluation.result.pumps.B1!;
    expect(screen.getByRole('heading', { name: 'Bomba B1' })).toBeInTheDocument();
    expect(screen.getByText('Q = 0,0 L/s, H = 50,0 m')).toBeInTheDocument();
    expect(screen.getByText('Q = 10,0 L/s, H = 44,0 m')).toBeInTheDocument();
    expect(screen.getByText('Q = 20,0 L/s, H = 26,0 m')).toBeInTheDocument();
    expect(value('a')).toBe(pt(curve.a));
    expect(value('b')).toBe(sig(curve.b, 5));
    expect(value('c')).toBe(pt(curve.c, 3));
    expect(value('q')).toBe(`${pt(result.flow * 1000)} L/s`);
    expect(value('h')).toBe(`${pt(result.head)} m`);
    expect(pumpHead(curve, result.flow)).toBeCloseTo(result.head, 9);
    expect(value('hgl-discharge')).toBe(`${pt(evaluation.result.nodes.J1!.head)} m`);
    expect(evaluation.result.nodes.R1!.head + result.head).toBeCloseTo(
      evaluation.result.nodes.J1!.head,
      6,
    );
  });

  it('shows the pump curve before the first solve', () => {
    const scenario = stage('stage5');
    useAppStore.setState({
      scenario,
      diameters: initialDiameters(scenario),
      selection: { type: 'pump', id: 'B1' },
    });
    render(<CalcPanel />);
    expect(value('a')).toBe('50,00');
    expect(document.querySelector('[data-value="h"]')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Os resultados precisam ser recalculados');
  });

  it('clears the selection', async () => {
    const user = userEvent.setup();
    openStage('stage3', { type: 'pipe', id: 'T1' });
    render(<CalcPanel />);
    await user.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(useAppStore.getState().selection).toBeNull();
    expect(screen.getByText('Resumo da rede')).toBeInTheDocument();
  });

  it('switches to English with the point as decimal separator', () => {
    const { evaluation } = openStage('stage3', { type: 'pipe', id: 'T1' });
    useAppStore.setState({ lang: 'en' });
    render(<CalcPanel />);
    expect(screen.getByRole('heading', { name: 'Pipe T1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Head loss' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('J = 10.643 × Q1.852 / (C1.852 × D4.87)');
    expect(value('hf')).toBe(`${Math.abs(evaluation.result.pipes.T1!.headLoss).toFixed(3)} m`);
    expect(screen.getByText('OK (0.6 to 3.5 m/s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument();
  });
});
