import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COMMERCIAL_DNS } from '../../engine/cost';
import { initialDiameters } from '../../game/buildNetwork';
import { getScenario } from '../../scenarios';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { mockMatchMedia } from './mockMatchMedia';
import { PHONE_QUERY } from './useMediaQuery';
import { SelectionBar } from './ViewControls';

function openStage() {
  const scenario = getScenario('stage4')!;
  useAppStore.setState({ scenario, diameters: initialDiameters(scenario) });
  return scenario;
}

describe('SelectionBar', () => {
  let restore = () => {};
  beforeEach(() => resetStore());
  afterEach(() => restore());

  it('asks for a selection while no pipe is selected', () => {
    openStage();
    render(<SelectionBar />);
    expect(screen.getByText('Selecione um trecho para alterar o diâmetro.')).toBeInTheDocument();
  });

  it('shows only the DN numbers on a wide screen, the price in the name of each option', () => {
    openStage();
    useAppStore.setState({ selection: { type: 'pipe', id: 'T2' } });
    render(<SelectionBar />);
    const group = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
    const option = within(group).getByRole('button', { name: /^DN 100, R\$\s65,00 por metro/ });
    expect(option).toHaveTextContent(/^100$/);
    expect(document.querySelector('.netview__bar--phone')).not.toBeInTheDocument();
    expect(document.querySelector('.netview__bar-title')).toHaveTextContent(
      'Trecho T2 · 300 m · DN',
    );
  });

  describe('on a phone', () => {
    beforeEach(() => {
      restore = mockMatchMedia([PHONE_QUERY]);
    });

    it('keeps the name and length of the pipe and says what the numbers are', () => {
      openStage();
      useAppStore.setState({ selection: { type: 'pipe', id: 'T2' } });
      render(<SelectionBar />);
      const title = document.querySelector('.netview__bar--phone .netview__bar-title');
      expect(title).toHaveTextContent('Trecho T2 · 300 m');
      expect(title).toHaveTextContent('DN e preço em R$/m');
    });

    it('lays the seven diameters out as one row of keys with the price under each DN', async () => {
      const user = userEvent.setup();
      openStage();
      useAppStore.setState({ selection: { type: 'pipe', id: 'T2' } });
      render(<SelectionBar />);
      const group = screen.getByRole('group', { name: 'Diâmetro nominal do trecho T2' });
      expect(group.closest('.dn-picker')).toHaveClass('dn-picker--compact', 'dn-picker--prices');
      const options = within(group).getAllByRole('button');
      expect(options).toHaveLength(COMMERCIAL_DNS.length);
      const dn150 = within(group).getByRole('button', { name: /^DN 150, R\$\s120,00 por metro/ });
      expect(dn150.querySelector('.dn-picker__dn')).toHaveTextContent('150');
      const price = dn150.querySelector('.dn-picker__price');
      expect(price).toHaveTextContent('120');
      // The visible number repeats the accessible name: hidden from assistive technology.
      expect(price).toHaveAttribute('aria-hidden', 'true');

      await user.click(dn150);
      expect(useAppStore.getState().diameters.T2).toBe(150);
      expect(dn150).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
