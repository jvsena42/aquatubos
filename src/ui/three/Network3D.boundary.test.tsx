import { render, screen } from '@testing-library/react';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import Network3D from './Network3D';

// The check passes but the renderer fails to start, as three.js does when the context
// cannot be created.
vi.mock('./webgl', () => ({ isWebGLAvailable: () => true }));
vi.mock('./Scene3D', () => ({
  default: () => {
    throw new Error('Error creating WebGL context.');
  },
}));

describe('Network3D when the renderer fails', () => {
  beforeEach(() => resetStore());

  it('shows the plain message instead of crashing', () => {
    // React logs the error it catches in the boundary.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scenario = getScenario('stage2')!;
    useAppStore.setState({ scenario, diameters: scenario.reference.diameters });
    render(<Network3D />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Este navegador não conseguiu iniciar o WebGL',
    );
    expect(screen.queryByRole('group', { name: 'Controles da vista 3D' })).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
