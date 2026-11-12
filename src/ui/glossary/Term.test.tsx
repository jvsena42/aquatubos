import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '../../state/store';
import { resetStore } from '../../test/store';
import { GLOSSARY, TERM_IDS } from './glossary';
import { GlossaryDialog } from './GlossaryDialog';
import { Term } from './Term';

describe('Term', () => {
  beforeEach(() => resetStore());

  it('describes the text with the definition and keeps the tooltip hidden at first', () => {
    render(<Term id="hgl">cota piezométrica</Term>);
    const trigger = screen.getByRole('button', { name: 'cota piezométrica' });
    expect(trigger).toHaveAccessibleDescription(
      `${GLOSSARY.hgl.term.pt}${GLOSSARY.hgl.definition.pt}`,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus, closes with Escape and on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Term id="headLoss">perda de carga</Term>
        <button type="button">outro</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'perda de carga' })).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent(GLOSSARY.headLoss.definition.pt);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    await user.tab({ shift: true });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on hover and closes when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<Term id="mca">mca</Term>);
    await user.hover(screen.getByRole('button', { name: 'mca' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.unhover(screen.getByRole('button', { name: 'mca' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses the term name when no text is given and follows the language', () => {
    useAppStore.setState({ lang: 'en' });
    render(<Term id="hardyCross" />);
    expect(screen.getByRole('button', { name: 'Hardy Cross method' })).toHaveAccessibleDescription(
      new RegExp('Iterative method for looped networks'),
    );
  });
});

describe('glossary', () => {
  beforeEach(() => resetStore());

  it('has a name and a definition in both languages for every term', () => {
    expect(TERM_IDS.length).toBeGreaterThanOrEqual(23);
    for (const id of TERM_IDS) {
      for (const lang of ['pt', 'en'] as const) {
        expect(GLOSSARY[id].term[lang].length).toBeGreaterThan(1);
        expect(GLOSSARY[id].definition[lang].length).toBeGreaterThan(20);
      }
    }
  });

  it('lists every term in the dialog', () => {
    render(<GlossaryDialog open onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Glossário' })).toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(TERM_IDS.length);
    expect(screen.getByText(GLOSSARY.nbr12218.definition.pt)).toBeInTheDocument();
  });
});
