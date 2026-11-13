import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { DETAIL } from './geometry';
import Network3D from './Network3D';
import type { Scene3DProps } from './Scene3D';
import { COARSE_QUERY, SMALL_QUERY } from './viewProfile';

// jsdom has no WebGL: the canvas is replaced by a stub that exposes what it was given.
vi.mock('./webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('./Scene3D', () => ({
  default: (props: Scene3DProps) => (
    <div
      role="img"
      aria-label={props.ariaLabel}
      data-max-dpr={props.profile.maxDpr}
      data-click-slop={props.profile.clickSlop}
      data-hit-scale={props.profile.hitScale}
      data-declutter={String(props.profile.compact)}
      data-grid-cells={props.model.detail.gridCells}
      data-vertices={props.model.terrain.positions.length / 3}
      data-reset={props.resetCount}
    />
  ),
}));

/** Makes the media queries of the view profile answer as the given device would. */
function device(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function openStage(id: string) {
  const scenario = getScenario(id)!;
  const diameters = scenario.reference.diameters;
  useAppStore.setState({ scenario, diameters, evaluation: evaluateStage(scenario, diameters) });
}

describe('Network3D on a phone', () => {
  beforeEach(() => {
    resetStore();
    device([COARSE_QUERY, SMALL_QUERY]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders at no more than 1.5× with the low geometry budget and touch tolerances', () => {
    openStage('stage2');
    render(<Network3D />);
    const scene = screen.getByRole('img');
    expect(scene).toHaveAttribute('data-max-dpr', '1.5');
    expect(scene).toHaveAttribute('data-grid-cells', String(DETAIL.low.gridCells));
    expect(scene).toHaveAttribute('data-click-slop', '10');
    expect(scene).toHaveAttribute('data-hit-scale', '1.8');
    expect(scene).toHaveAttribute('data-declutter', 'true');
  });

  it('keeps the accessible names of the controls with shorter visible texts', async () => {
    const user = userEvent.setup();
    openStage('stage2');
    render(<Network3D />);
    const controls = within(screen.getByRole('group', { name: 'Controles da vista 3D' }));
    const scale = within(controls.getByRole('group', { name: 'Exagero vertical' }));
    expect(scale.getByRole('button', { name: 'Exagero vertical de 5×' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Vertical')).toBeInTheDocument();
    const reset = controls.getByRole('button', { name: 'Recentrar vista' });
    expect(reset).toHaveTextContent(/^Recentrar$/);
    await user.click(reset);
    expect(screen.getByRole('img')).toHaveAttribute('data-reset', '1');
  });

  it('shows the pressure summary and opens the legend and the touch help from a button', async () => {
    const user = userEvent.setup();
    openStage('stage2');
    render(<Network3D />);
    expect(
      screen.getByText('Nó crítico: N4, com pressão dinâmica de 10,6 mca (mínimo de 10 mca).'),
    ).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Legenda' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Legenda' })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(panel).toBeVisible();
    expect(within(panel).getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
    expect(within(panel).getByText(/^Arraste com um dedo para girar\./)).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
  });

  it('thins the labels: no pipe labels, pressures without the unit, ids for the rest', () => {
    openStage('stage2');
    render(<Network3D />);
    expect(screen.queryByText(/^DN /)).toBeNull();
    expect(screen.getByText('N4 · 10,6')).toBeInTheDocument();
    expect(screen.queryByText('N4 · 10,6 mca')).toBeNull();
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.queryByText('R1 · NA 150,0 m')).toBeNull();
  });

  it('gives the selected element its full label, so a tap reveals what was thinned out', () => {
    openStage('stage2');
    useAppStore.setState({ selection: { type: 'pipe', id: 'T3' } });
    const { rerender } = render(<Network3D />);
    expect(screen.getByText(/^T3 · DN \d+$/)).toBeInTheDocument();
    expect(screen.getAllByText(/DN \d+$/)).toHaveLength(1);

    useAppStore.setState({ selection: { type: 'node', id: 'N4' } });
    rerender(<Network3D />);
    expect(screen.getByText('N4 · 10,6 mca')).toBeInTheDocument();
    expect(screen.queryByText(/DN \d+$/)).toBeNull();

    useAppStore.setState({ selection: { type: 'reservoir', id: 'R1' } });
    rerender(<Network3D />);
    expect(screen.getByText('R1 · NA 150,0 m')).toBeInTheDocument();
  });

  it('shortens the outdated note', () => {
    openStage('stage2');
    useAppStore.setState({ stale: true });
    render(<Network3D />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Resultados desatualizados\. Calcule novamente\.$/,
    );
  });

  it('uses the English texts', async () => {
    const user = userEvent.setup();
    openStage('stage2');
    useAppStore.setState({ lang: 'en' });
    render(<Network3D />);
    expect(screen.getByRole('button', { name: 'Reset view' })).toHaveTextContent(/^Reset$/);
    await user.click(screen.getByRole('button', { name: 'Legend' }));
    expect(screen.getByText(/^Drag with one finger to rotate\./)).toBeInTheDocument();
  });
});

describe('Network3D on other devices', () => {
  beforeEach(() => resetStore());
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the desktop layout, 2× and the full budget with a mouse on a wide screen', () => {
    device([]);
    openStage('stage2');
    render(<Network3D />);
    const scene = screen.getByRole('img');
    expect(scene).toHaveAttribute('data-max-dpr', '2');
    expect(scene).toHaveAttribute('data-grid-cells', String(DETAIL.high.gridCells));
    expect(scene).toHaveAttribute('data-declutter', 'false');
    expect(screen.getByRole('button', { name: 'Recentrar vista' })).toHaveTextContent(
      'Recentrar vista',
    );
    expect(screen.getByText('Exagero vertical')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Legenda' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
    expect(screen.getByText(/^Arraste para girar\./)).toBeInTheDocument();
    expect(screen.getByText('N4 · 10,6 mca')).toBeInTheDocument();
    expect(screen.getAllByText('DN 100')).toHaveLength(2);
  });

  it('lowers the budget on a tablet but keeps the full layout and labels', () => {
    device([COARSE_QUERY]);
    openStage('stage2');
    const { container } = render(<Network3D />);
    const scene = screen.getByRole('img');
    expect(scene).toHaveAttribute('data-max-dpr', '1.5');
    expect(scene).toHaveAttribute('data-grid-cells', String(DETAIL.low.gridCells));
    expect(scene).toHaveAttribute('data-hit-scale', '1.8');
    expect(screen.queryByRole('button', { name: 'Legenda' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
    expect(screen.getByText(/^Arraste com um dedo para girar\./)).toBeInTheDocument();
    expect(screen.getByText('N4 · 10,6 mca')).toBeInTheDocument();
    expect(container.querySelector('.net3d--compact')).toBeNull();
  });

  it('draws fewer terrain vertices on a phone than on a desktop', () => {
    openStage('stage2');
    device([]);
    const desktop = render(<Network3D />);
    const full = Number(screen.getByRole('img').getAttribute('data-vertices'));
    desktop.unmount();
    device([COARSE_QUERY, SMALL_QUERY]);
    render(<Network3D />);
    const reduced = Number(screen.getByRole('img').getAttribute('data-vertices'));
    expect(reduced).toBeGreaterThan(0);
    expect(reduced).toBeLessThan(full * 0.6);
  });
});
