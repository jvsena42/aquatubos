import { render, screen } from '@testing-library/react';
import { evaluateStage } from '../../game/evaluate';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import Network3D from './Network3D';
import { isWebGLAvailable } from './webgl';

function openStage2() {
  const scenario = getScenario('stage2')!;
  const diameters = scenario.reference.diameters;
  useAppStore.setState({ scenario, diameters, evaluation: evaluateStage(scenario, diameters) });
}

describe('Network3D without WebGL', () => {
  beforeEach(() => resetStore());

  it('reports that jsdom has no WebGL', () => {
    expect(isWebGLAvailable()).toBe(false);
  });

  it('shows a plain message and the text summary instead of the canvas', () => {
    openStage2();
    const { container } = render(<Network3D />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Este navegador não conseguiu iniciar o WebGL',
    );
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByText('Nó crítico: N4, com pressão dinâmica de 10,6 mca (mínimo de 10 mca).'),
    ).toBeInTheDocument();
  });

  it('shows the message in English', () => {
    openStage2();
    useAppStore.setState({ lang: 'en' });
    render(<Network3D />);
    expect(screen.getByRole('status')).toHaveTextContent('This browser could not start WebGL');
    expect(
      screen.getByText('Critical node: N4, with a dynamic pressure of 10.6 mca (minimum 10 mca).'),
    ).toBeInTheDocument();
  });

  it('renders nothing when no stage is open', () => {
    const { container } = render(<Network3D />);
    expect(container).toBeEmptyDOMElement();
  });
});
