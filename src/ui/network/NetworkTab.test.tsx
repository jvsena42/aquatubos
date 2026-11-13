import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluateStage } from '../../game/evaluate';
import { loadPreferences } from '../../persistence/db';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { NetworkModeToggle, NetworkTab } from './NetworkTab';

describe('NetworkTab', () => {
  beforeEach(() => {
    resetStore();
    const scenario = getScenario('stage3')!;
    useAppStore.setState({
      scenario,
      diameters: scenario.reference.diameters,
      evaluation: evaluateStage(scenario, scenario.reference.diameters),
    });
  });

  it('shows the town by default and switches to the schematic', async () => {
    const user = userEvent.setup();
    render(<NetworkTab />);
    const town = screen.getByRole('button', { name: 'Cidade' });
    const schematic = screen.getByRole('button', { name: 'Esquema' });
    expect(town).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('group', { name: 'Desenho da rede' })).not.toBeInTheDocument();

    await user.click(schematic);
    expect(schematic).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Desenho da rede' })).toBeInTheDocument();
    expect(useAppStore.getState().networkView).toBe('schematic');
    await vi.waitFor(async () => expect((await loadPreferences()).networkView).toBe('schematic'));
  });

  it('keeps the selection when the view changes', async () => {
    const user = userEvent.setup();
    useAppStore.getState().select({ type: 'pipe', id: 'T2' });
    render(<NetworkTab />);
    await user.click(screen.getByRole('button', { name: 'Esquema' }));
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
    await user.click(screen.getByRole('button', { name: 'Cidade' }));
    expect(useAppStore.getState().selection).toEqual({ type: 'pipe', id: 'T2' });
  });

  it('labels the toggle in English', () => {
    useAppStore.setState({ lang: 'en' });
    render(<NetworkTab />);
    expect(screen.getByRole('group', { name: 'Network view mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Town' })).toBeInTheDocument();
  });

  it('leaves the switch out when the caller shows it elsewhere', () => {
    render(<NetworkTab toggle={false} />);
    expect(screen.queryByRole('button', { name: 'Esquema' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Mapa da cidade' })).toBeInTheDocument();
  });

  it('keeps the names of the options on the compact switch, which shows icons', async () => {
    const user = userEvent.setup();
    render(<NetworkModeToggle compact />);
    const schematic = screen.getByRole('button', { name: 'Esquema' });
    expect(schematic).not.toHaveTextContent('Esquema');
    expect(schematic.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cidade' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(schematic);
    expect(schematic).toHaveAttribute('aria-pressed', 'true');
    expect(useAppStore.getState().networkView).toBe('schematic');
  });
});
