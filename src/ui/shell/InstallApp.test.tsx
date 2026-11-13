import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetPwaInstall, useInstallStore, type BeforeInstallPromptEvent } from '../../pwa/install';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { InstallButton } from './InstallApp';

function promptEvent() {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

describe('InstallButton', () => {
  beforeEach(() => {
    resetStore();
    resetPwaInstall();
  });

  it('renders nothing in a browser without an install route', () => {
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the native prompt in Chromium and disappears once installed', async () => {
    const user = userEvent.setup();
    const event = promptEvent();
    useInstallStore.setState({ deferred: event });
    render(<InstallButton />);
    await user.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument(),
    );
  });

  it('opens the Share → Add to Home Screen steps on iPhone and iPad', async () => {
    const user = userEvent.setup();
    useInstallStore.setState({ ios: true });
    render(<InstallButton />);
    await user.click(screen.getByRole('button', { name: 'Instalar app' }));
    const dialog = screen.getByRole('dialog', { name: 'Instalar no iPhone ou iPad' });
    expect(dialog).toHaveTextContent('Toque em Compartilhar');
    expect(dialog).toHaveTextContent('Adicionar à Tela de Início');
    expect(dialog).toHaveTextContent('Toque em Adicionar');
    await user.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByText('Toque em Compartilhar')).not.toBeInTheDocument();
  });

  it('is hidden when running standalone, even on iOS or with a prompt', () => {
    useInstallStore.setState({ ios: true, standalone: true, deferred: promptEvent() });
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden after appinstalled', () => {
    useInstallStore.setState({ deferred: promptEvent() });
    render(<InstallButton />);
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeInTheDocument();
    act(() => {
      useInstallStore.setState({ installed: true, deferred: null });
    });
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('is labelled in English', () => {
    useAppStore.setState({ lang: 'en' });
    useInstallStore.setState({ ios: true });
    render(<InstallButton />);
    expect(screen.getByRole('button', { name: 'Install app' })).toBeInTheDocument();
  });
});
