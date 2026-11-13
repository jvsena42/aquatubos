import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_CHECK_SETTINGS } from '../../engine/checks';
import { resetStore } from '../../test/store';
import { PHONE_QUERY } from '../shell/breakpoints';
import { LegendHelp, LegendIcons } from './Legend';
import { mockMatchMedia } from './mockMatchMedia';

const checks = DEFAULT_CHECK_SETTINGS;

describe('LegendIcons', () => {
  beforeEach(() => resetStore());

  it('is a strip of symbols without text, each named and with a tooltip', () => {
    render(<LegendIcons checks={checks} evaluated />);
    const list = screen.getByRole('list', { name: 'Legenda' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-entry'))).toEqual([
      'node-ok',
      'node-low',
      'node-high',
      'pipe-low',
      'pipe-ok',
      'pipe-high',
      'direction',
      'width',
    ]);
    expect(list).toHaveTextContent('');
    for (const item of items) {
      const symbol = within(item).getByRole('img');
      expect(symbol).toHaveAccessibleName(item.getAttribute('title')!);
      expect(symbol.querySelector('svg')).not.toBeNull();
    }
    expect(
      within(list).getByRole('img', { name: 'Dinâmica abaixo de 10 mca' }),
    ).toBeInTheDocument();
    expect(within(list).getByRole('img', { name: 'V acima de 3,5 m/s' })).toBeInTheDocument();
  });

  it('marks the pipes outside the velocity limits with the icon of the map', () => {
    render(<LegendIcons checks={checks} evaluated />);
    const entry = (key: string) => document.querySelector(`[data-entry="${key}"]`)!;
    expect(entry('pipe-low').querySelector('.netview__pipe-mark')).not.toBeNull();
    expect(entry('pipe-high').querySelector('.netview__pipe-mark')).not.toBeNull();
    expect(entry('pipe-ok').querySelector('.netview__pipe-mark')).toBeNull();
  });

  it('follows the checks of the stage and shows only the neutral entry before a result', () => {
    const view = render(
      <LegendIcons
        checks={{ ...checks, maxStaticPressure: 'off', minVelocity: 'off' }}
        evaluated
      />,
    );
    const keys = () =>
      [...document.querySelectorAll('[data-entry]')].map((item) => item.getAttribute('data-entry'));
    expect(keys()).toEqual(['node-ok', 'node-low', 'pipe-ok', 'pipe-high', 'direction', 'width']);
    view.rerender(<LegendIcons checks={checks} evaluated={false} />);
    expect(keys()).toEqual(['width']);
  });

  it('shows the three node states always when asked to, with the given symbols and texts', () => {
    render(
      <LegendIcons
        checks={{ ...checks, maxStaticPressure: 'off' }}
        evaluated={false}
        allNodeStates
        nodeSwatch={(status) => <svg data-testid={`swatch-${status}`} />}
        nodeText={{ ok: 'Casas atendidas', low: 'Torneiras secas', high: 'Risco de rompimento' }}
      />,
    );
    for (const [status, name] of [
      ['ok', 'Casas atendidas'],
      ['low', 'Torneiras secas'],
      ['high', 'Risco de rompimento'],
    ] as const) {
      expect(screen.getByRole('img', { name })).toContainElement(
        screen.getByTestId(`swatch-${status}`),
      );
    }
  });
});

describe('LegendHelp', () => {
  beforeEach(() => resetStore());

  it('keeps the texts behind a "?" that opens a popover', async () => {
    const user = userEvent.setup();
    render(<LegendHelp checks={checks} evaluated />);
    expect(screen.queryByText('Pressão adequada')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajuda: Legenda' }));
    const help = screen.getByRole('note', { name: 'Ajuda: Legenda' });
    for (const text of [
      'Pressão adequada',
      'Dinâmica abaixo de 10 mca',
      'Estática acima de 40 mca',
      'V abaixo de 0,6 m/s',
      'V de 0,6 a 3,5 m/s',
      'V acima de 3,5 m/s',
      'Sentido do escoamento',
      'Espessura proporcional ao DN',
    ]) {
      expect(within(help).getByText(text)).toBeInTheDocument();
    }
    // What the labels and the gestures are is explained here, not on the drawing.
    expect(help).toHaveTextContent('Trechos: identificação e DN em mm.');
    expect(help).toHaveTextContent('Arraste para mover');
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Pressão adequada')).not.toBeInTheDocument();
  });

  it('opens as a dialog on a phone', async () => {
    const restore = mockMatchMedia([PHONE_QUERY]);
    try {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<LegendHelp checks={checks} evaluated />);
      await user.click(screen.getByRole('button', { name: 'Ajuda: Legenda' }));
      expect(screen.getByRole('dialog', { name: 'Legenda' })).toHaveTextContent(
        'Sentido do escoamento',
      );
    } finally {
      restore();
    }
  });
});
