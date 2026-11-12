import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initialDiameters } from '../../game/buildNetwork';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import Network3D from './Network3D';
import type { Scene3DProps } from './Scene3D';

// jsdom has no WebGL: the canvas is replaced by a stub that exposes what it was given.
vi.mock('./webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('./Scene3D', () => ({
  default: (props: Scene3DProps) => (
    <div
      role="img"
      aria-label={props.ariaLabel}
      data-hgl={String(props.showHgl && props.model.hgl !== null)}
      data-stale={String(props.stale)}
      data-exaggeration={props.model.exaggeration}
      data-reset={props.resetCount}
      data-selection={props.selection ? `${props.selection.type}:${props.selection.id}` : ''}
    >
      <button type="button" onClick={() => props.onSelect({ type: 'pipe', id: 'T3' })}>
        stub pipe T3
      </button>
    </div>
  ),
}));

function openStage2(design: 'reference' | 'initial' | 'unsolved' = 'reference') {
  const scenario = getScenario('stage2')!;
  const diameters =
    design === 'reference' ? scenario.reference.diameters : initialDiameters(scenario);
  useAppStore.setState({
    scenario,
    diameters,
    evaluation: design === 'unsolved' ? null : evaluateStage(scenario, diameters),
  });
}

describe('Network3D controls', () => {
  beforeEach(() => resetStore());

  it('renders the controls with Portuguese labels', () => {
    openStage2();
    render(<Network3D />);
    const controls = within(screen.getByRole('group', { name: 'Controles da vista 3D' }));
    const scale = within(controls.getByRole('group', { name: 'Exagero vertical' }));
    expect(scale.getByRole('button', { name: 'Exagero vertical de 1×' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(scale.getByRole('button', { name: 'Exagero vertical de 5×' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(scale.getByRole('button', { name: 'Exagero vertical de 10×' })).toBeInTheDocument();
    expect(controls.getByRole('button', { name: 'Linha piezométrica' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(controls.getByRole('button', { name: 'Rótulos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(controls.getByRole('button', { name: 'Recentrar vista' })).toBeInTheDocument();
    expect(screen.getByText('Alturas ampliadas 5×')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(
      /^Vista 3D da rede de Terreno acidentado: terreno, tubos, nós coloridos pela pressão/,
    );
    expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
  });

  it('renders the controls with English labels', () => {
    openStage2();
    useAppStore.setState({ lang: 'en' });
    render(<Network3D />);
    const controls = within(screen.getByRole('group', { name: '3D view controls' }));
    const scale = within(controls.getByRole('group', { name: 'Vertical exaggeration' }));
    expect(scale.getByRole('button', { name: 'Vertical exaggeration 5×' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(controls.getByRole('button', { name: 'Hydraulic grade line' })).toBeInTheDocument();
    expect(controls.getByRole('button', { name: 'Labels' })).toBeInTheDocument();
    expect(controls.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
    expect(screen.getByText('Heights exaggerated 5×')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/^3D view of the Uneven terrain network/);
    expect(screen.getByText('N4 · 10.6 m H2O')).toBeInTheDocument();
  });

  it('changes the vertical exaggeration and states the factor', async () => {
    const user = userEvent.setup();
    openStage2();
    render(<Network3D />);
    expect(screen.getByRole('img')).toHaveAttribute('data-exaggeration', '5');

    await user.click(screen.getByRole('button', { name: 'Exagero vertical de 10×' }));
    expect(screen.getByRole('img')).toHaveAttribute('data-exaggeration', '10');
    expect(screen.getByText('Alturas ampliadas 10×')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exagero vertical de 1×' }));
    expect(screen.getByText('Alturas em escala real (1×)')).toBeInTheDocument();
  });

  it('toggles the HGL surface and the labels, and resets the view', async () => {
    const user = userEvent.setup();
    openStage2();
    render(<Network3D />);
    expect(screen.getByRole('img')).toHaveAttribute('data-hgl', 'true');
    expect(screen.getByText('N4 · 10,6 mca')).toBeInTheDocument();
    expect(screen.getByText('R1 · NA 150,0 m')).toBeInTheDocument();
    expect(screen.getAllByText('DN 100')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Linha piezométrica' }));
    expect(screen.getByRole('img')).toHaveAttribute('data-hgl', 'false');
    expect(screen.getByRole('button', { name: 'Linha piezométrica' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(screen.getByRole('button', { name: 'Rótulos' }));
    expect(screen.queryByText('N4 · 10,6 mca')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Recentrar vista' }));
    expect(screen.getByRole('img')).toHaveAttribute('data-reset', '1');
  });

  it('passes the selection to the scene and stores what the scene selects', async () => {
    const user = userEvent.setup();
    openStage2();
    useAppStore.setState({ selection: { type: 'node', id: 'N2' } });
    render(<Network3D />);
    expect(screen.getByRole('img')).toHaveAttribute('data-selection', 'node:N2');

    await user.click(screen.getByRole('button', { name: 'stub pipe T3' }));
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T3' });
    expect(screen.getByRole('img')).toHaveAttribute('data-selection', 'pipe:T3');
  });

  it('shows a note and tells the scene when the results are outdated', () => {
    openStage2();
    useAppStore.setState({ stale: true });
    render(<Network3D />);
    expect(screen.getByRole('status')).toHaveTextContent('Resultados desatualizados');
    expect(screen.getByRole('img')).toHaveAttribute('data-stale', 'true');
  });

  it('shows terrain and network only before there is a result', () => {
    openStage2('unsolved');
    render(<Network3D />);
    expect(screen.getByRole('img')).toHaveAttribute('data-hgl', 'false');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Vista 3D da rede de Terreno acidentado: terreno, tubos, nós e reservatório.',
    );
    expect(screen.getByRole('button', { name: 'Linha piezométrica' })).toBeDisabled();
    expect(screen.getByText('N4')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ainda não há resultado. Calcule para ver as pressões e a linha piezométrica.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says that the critical node is below the minimum in an undersized design', () => {
    openStage2('initial');
    render(<Network3D />);
    expect(
      screen.getByText(
        /^Nó crítico: N6, com pressão dinâmica de -77,7 mca, abaixo do mínimo de 10 mca\.$/,
      ),
    ).toBeInTheDocument();
  });
});
