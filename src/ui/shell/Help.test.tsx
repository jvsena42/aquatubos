import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { PHONE_QUERY } from './breakpoints';
import { HelpButton } from './Help';

function mockPhone() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query === PHONE_QUERY,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('HelpButton', () => {
  beforeEach(() => resetStore());
  afterEach(() => vi.unstubAllGlobals());

  it('is named after its topic and starts closed', () => {
    render(<HelpButton topic="Pressão mínima">Texto de ajuda</HelpButton>);
    const button = screen.getByRole('button', { name: 'Ajuda: Pressão mínima' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Texto de ajuda')).not.toBeInTheDocument();
  });

  it('opens and closes with the keyboard and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<HelpButton topic="Pressão mínima">Texto de ajuda</HelpButton>);
    const button = screen.getByRole('button', { name: 'Ajuda: Pressão mínima' });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note', { name: 'Ajuda: Pressão mínima' })).toHaveTextContent(
      'Texto de ajuda',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Texto de ajuda')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByText('Texto de ajuda')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(screen.queryByText('Texto de ajuda')).not.toBeInTheDocument();
  });

  it('closes on a press outside and stays open on a press inside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <HelpButton topic="Custo">Texto de ajuda</HelpButton>
        <p>fora</p>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Ajuda: Custo' }));
    fireEvent.pointerDown(screen.getByText('Texto de ajuda'));
    expect(screen.getByText('Texto de ajuda')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(screen.queryByText('Texto de ajuda')).not.toBeInTheDocument();
  });

  it('opens a dialog on phones, by touch, and closes with its close button', async () => {
    mockPhone();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<HelpButton topic="Casas atendidas">Texto de ajuda</HelpButton>);
    const button = screen.getByRole('button', { name: 'Ajuda: Casas atendidas' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.pointer({ keys: '[TouchA]', target: button });
    const dialog = screen.getByRole('dialog', { name: 'Casas atendidas' });
    expect(dialog).toHaveTextContent('Texto de ajuda');
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Texto de ajuda')).not.toBeInTheDocument();
  });

  it('uses the English prefix', () => {
    useAppStore.setState({ lang: 'en' });
    render(<HelpButton topic="Cost">Help text</HelpButton>);
    expect(screen.getByRole('button', { name: 'Help: Cost' })).toBeInTheDocument();
  });
});
