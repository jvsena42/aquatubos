import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Menu, type MenuEntry } from './Menu';

function Example({ onAction = () => undefined }: { onAction?: (id: string) => void }) {
  const [formula, setFormula] = useState('hw');
  const entries: MenuEntry[] = [
    { kind: 'action', id: 'briefing', label: 'Enunciado', onSelect: () => onAction('briefing') },
    {
      kind: 'radio',
      id: 'formula',
      label: 'Fórmula',
      value: formula,
      options: [
        { value: 'hw', label: 'Hazen-Williams' },
        { value: 'dw', label: 'Darcy-Weisbach' },
      ],
      onChange: setFormula,
    },
    { kind: 'action', id: 'reset', label: 'Restaurar', onSelect: () => onAction('reset') },
  ];
  return (
    <>
      <Menu label="Mais ações" icon={<span>⋮</span>} entries={entries} />
      <button type="button">Fora</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Mais ações' });

describe('Menu', () => {
  it('is a closed menu button until it is pressed', async () => {
    const user = userEvent.setup();
    render(<Example />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'Mais ações' });
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', menu.id);
    expect(within(menu).getByRole('menuitem', { name: 'Enunciado' })).toHaveFocus();
  });

  it('moves between the items with the arrow keys, Home and End, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Example />);
    trigger().focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Enunciado' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Hazen-Williams' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Restaurar' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Enunciado' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Restaurar' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Enunciado' })).toHaveFocus();
  });

  it('opens on the last item with the up arrow', async () => {
    const user = userEvent.setup();
    render(<Example />);
    trigger().focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Restaurar' })).toHaveFocus();
  });

  it('runs an item, closes and gives the focus back to the button', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Example onAction={onAction} />);
    trigger().focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{End}{Enter}');
    expect(onAction).toHaveBeenCalledWith('reset');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('offers a choice as a group of radio items', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());
    const group = screen.getByRole('group', { name: 'Fórmula' });
    expect(within(group).getByRole('menuitemradio', { name: 'Hazen-Williams' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(group).getByRole('menuitemradio', { name: 'Darcy-Weisbach' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger());
    expect(screen.getByRole('menuitemradio', { name: 'Darcy-Weisbach' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Hazen-Williams' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('closes on Escape, returning the focus, and on a press outside', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Fora' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when Tab leaves it', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(trigger());
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
