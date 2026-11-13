import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { AboutDialog } from './AboutDialog';
import { HowToPlayDialog } from './HowToPlayDialog';
import { HOW_TO_STEPS } from './strings';

vi.mock('../../scenarios', async () => {
  const { fixtureScenarios } = await import('../../test/fixtures');
  return {
    SCENARIOS: fixtureScenarios,
    getScenario: (id: string) => fixtureScenarios.find((s) => s.id === id),
  };
});
vi.mock('../../worker/client', () => ({ evaluateInWorker: vi.fn() }));

const DIALOGS = { 'Como jogar': HowToPlayDialog, Sobre: AboutDialog } as const;

/** The dialogs are opened from the header menu; here a plain button stands in for it. */
function Host({ label, dialog }: { label: string; dialog: keyof typeof DIALOGS }) {
  const [isOpen, setOpen] = useState(false);
  const Component = DIALOGS[dialog];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Component open={isOpen} onClose={() => setOpen(false)} />
    </>
  );
}

const ENGLISH: Record<string, keyof typeof DIALOGS> = {
  'How to play': 'Como jogar',
  About: 'Sobre',
};

async function open(button: string) {
  const user = userEvent.setup();
  render(<Host label={button} dialog={ENGLISH[button] ?? (button as keyof typeof DIALOGS)} />);
  await user.click(screen.getByRole('button', { name: button }));
  return user;
}

describe('home dialogs', () => {
  beforeEach(() => resetStore());

  describe('how to play', () => {
    const TITLES = [
      'Escolha os diâmetros',
      'Calcule e verifique',
      'Veja as casas atendidas',
      'Ganhe estrelas pelo custo',
    ];

    it('opens on the first of four illustrated steps', async () => {
      await open('Como jogar');
      const dialog = within(screen.getByRole('dialog', { name: 'Como jogar' }));
      expect(dialog.getByRole('heading', { level: 3, name: TITLES[0] })).toBeInTheDocument();
      expect(dialog.getByText('Passo 1 de 4')).toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Anterior' })).toBeDisabled();
      // The dialog gives its first focus to the button that moves on.
      expect(dialog.getByRole('button', { name: 'Próximo' })).toHaveAttribute('autofocus');
      expect(dialog.getAllByRole('listitem')).toHaveLength(4);
      expect(screen.getByRole('dialog').querySelector('.howto__art')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('says each step in one short sentence, in both languages', () => {
      expect(HOW_TO_STEPS).toHaveLength(4);
      for (const step of HOW_TO_STEPS) {
        for (const text of [step.text.pt, step.text.en]) {
          expect(text.split(/\s+/).length).toBeLessThanOrEqual(12);
          expect(text.match(/[.!?]/g)).toHaveLength(1);
        }
      }
    });

    it('walks through the steps with next and previous', async () => {
      const user = await open('Como jogar');
      const dialog = within(screen.getByRole('dialog'));
      for (const title of TITLES.slice(1)) {
        await user.click(dialog.getByRole('button', { name: 'Próximo' }));
        expect(dialog.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
      }
      expect(dialog.queryByRole('button', { name: 'Próximo' })).not.toBeInTheDocument();
      await user.click(dialog.getByRole('button', { name: 'Anterior' }));
      expect(dialog.getByRole('heading', { level: 3, name: TITLES[2] })).toBeInTheDocument();
    });

    it('closes from the last step and starts over when reopened', async () => {
      const user = await open('Como jogar');
      const dialog = within(screen.getByRole('dialog'));
      await user.click(
        dialog.getByRole('button', { name: 'Passo 4 de 4: Ganhe estrelas pelo custo' }),
      );
      await user.click(dialog.getByRole('button', { name: 'Entendi' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Como jogar' }));
      expect(screen.getByRole('heading', { level: 3, name: TITLES[0] })).toBeInTheDocument();
    });

    it('marks the current step in the dots', async () => {
      const user = await open('Como jogar');
      const dialog = within(screen.getByRole('dialog'));
      const dot = (n: number) =>
        dialog.getByRole('button', { name: new RegExp(`^Passo ${n} de 4`) });
      expect(dot(1)).toHaveAttribute('aria-current', 'step');
      await user.click(dot(3));
      expect(dot(3)).toHaveAttribute('aria-current', 'step');
      expect(dot(1)).not.toHaveAttribute('aria-current');
      expect(dialog.getByRole('heading', { level: 3, name: TITLES[2] })).toBeInTheDocument();
    });

    it('works with the keyboard: arrow keys, Tab and Enter', async () => {
      const user = await open('Como jogar');
      const dialog = within(screen.getByRole('dialog'));
      dialog.getByRole('button', { name: 'Próximo' }).focus();
      await user.keyboard('{ArrowRight}{ArrowRight}');
      expect(dialog.getByText('Passo 3 de 4')).toBeInTheDocument();
      await user.keyboard('{ArrowLeft}');
      expect(dialog.getByText('Passo 2 de 4')).toBeInTheDocument();
      await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
      expect(dialog.getByText('Passo 1 de 4')).toBeInTheDocument();

      await user.keyboard('{Enter}');
      expect(dialog.getByText('Passo 2 de 4')).toBeInTheDocument();
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      expect(dialog.getByText('Passo 4 de 4')).toBeInTheDocument();
    });

    it('follows the language', async () => {
      useAppStore.setState({ lang: 'en' });
      const user = await open('How to play');
      const dialog = within(screen.getByRole('dialog', { name: 'How to play' }));
      expect(dialog.getByRole('heading', { level: 3, name: 'Choose the diameters' })).toBeVisible();
      await user.click(dialog.getByRole('button', { name: 'Next' }));
      expect(dialog.getByText('Step 2 of 4')).toBeInTheDocument();
    });
  });

  describe('about', () => {
    it('credits the original app and links to both repositories in a new tab', async () => {
      await open('Sobre');
      const dialog = within(screen.getByRole('dialog', { name: 'Sobre o Aquatubos' }));
      expect(dialog.getByText(/Unity, 2021/)).toBeInTheDocument();

      const original = dialog.getByRole('link', { name: /Repositório do aplicativo original/ });
      expect(original).toHaveAttribute('href', 'https://github.com/jvsena42/aquaplay_tcc');
      const source = dialog.getByRole('link', { name: /Código-fonte no GitHub/ });
      expect(source).toHaveAttribute('href', 'https://github.com/jvsena42/aquatubos');
      for (const link of dialog.getAllByRole('link')) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link).toHaveAccessibleName(/abre em nova aba/);
      }
    });

    it('is a short list: what you learn, the basis, the licence and that progress is local', async () => {
      await open('Sobre');
      const dialog = within(screen.getByRole('dialog'));
      expect(dialog.getAllByRole('listitem')).toHaveLength(7);
      expect(dialog.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
      expect(dialog.getByText(/Jogo educativo/)).toBeInTheDocument();
      expect(dialog.getByText(/Hazen-Williams.*Hardy Cross.*NBR 12218/)).toBeInTheDocument();
      expect(dialog.getByText(/ABNT NBR 12218:2017/)).toBeInTheDocument();
      expect(dialog.getByText(/validado contra o EPANET/)).toBeInTheDocument();
      expect(dialog.getByText(/Preços dos tubos ilustrativos/)).toBeInTheDocument();
      expect(dialog.getByText(/O progresso fica salvo neste dispositivo/)).toBeInTheDocument();
      expect(dialog.getByText(/licença MIT/)).toBeInTheDocument();
      expect(dialog.getByText(/Ferramenta de ensino, não um software de projeto/)).toBeVisible();
    });

    it('closes with the close button and follows the language', async () => {
      useAppStore.setState({ lang: 'en' });
      const user = await open('About');
      const dialog = within(screen.getByRole('dialog', { name: 'About Aquatubos' }));
      expect(dialog.getByText(/teaching tool, not design software/i)).toBeInTheDocument();
      expect(dialog.getByRole('link', { name: /Source code on GitHub/ })).toBeInTheDocument();
      await user.click(dialog.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
