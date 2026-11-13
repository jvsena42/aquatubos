import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetPwaInstall, useInstallStore, type BeforeInstallPromptEvent } from '../pwa/install';
import { resetStore } from '../test/store';
import { App } from './App';

function promptEvent() {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  return event;
}

describe('install item in the header menu', () => {
  beforeEach(() => {
    resetStore();
    resetPwaInstall();
  });

  const openMenu = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    return user;
  };

  it('is absent where installing is not possible', async () => {
    render(<App />);
    await openMenu();
    expect(screen.getByRole('menuitem', { name: 'Como jogar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('sits between the theme group and Sobre and shows the native prompt', async () => {
    const event = promptEvent();
    useInstallStore.setState({ deferred: event });
    render(<App />);
    const user = await openMenu();
    const menu = screen.getByRole('menu', { name: 'Menu' });
    const names = Array.from(
      menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'),
    ).map((item) => item.textContent?.trim() ?? '');
    expect(names.indexOf('Instalar app')).toBe(names.indexOf('Sobre') - 1);
    expect(names.indexOf('Instalar app')).toBeGreaterThan(names.indexOf('Escuro'));
    await user.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('opens the iOS steps from the menu and disappears when running standalone', async () => {
    useInstallStore.setState({ ios: true });
    render(<App />);
    const user = await openMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Instalar app' }));
    expect(screen.getByRole('dialog', { name: 'Instalar no iPhone ou iPad' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendi' }));
    act(() => {
      useInstallStore.setState({ standalone: true });
    });
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Instalar app' })).not.toBeInTheDocument();
  });
});
