import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getScenario } from '../../scenarios';
import { resetStore } from '../../test/store';
import { Legend } from './Legend';

const checks = getScenario('stage4')!.checks;

describe('Legend', () => {
  beforeEach(() => resetStore());

  it('shows the list inline by default, without a button', () => {
    render(<Legend checks={checks} evaluated />);
    expect(screen.getByRole('list', { name: 'Legenda' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Legenda' })).not.toBeInTheDocument();
  });

  it('stays behind a "Legenda" button when collapsed and opens on a tap', async () => {
    const user = userEvent.setup();
    render(<Legend checks={checks} evaluated collapsed />);
    const button = screen.getByRole('button', { name: 'Legenda' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: 'Legenda' });
    expect(button).toHaveAttribute('aria-controls', list.id);
    expect(list).toHaveTextContent('Sentido do escoamento');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('closes on Escape and on a press outside, not on a press inside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <p>fora</p>
        <Legend checks={checks} evaluated collapsed />
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Legenda' });

    await user.click(button);
    fireEvent.pointerDown(screen.getByRole('list'));
    expect(screen.getByRole('list')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(button);
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
