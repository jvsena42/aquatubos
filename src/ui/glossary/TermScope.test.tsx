import { StrictMode, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { resetStore } from '../../test/store';
import { Term } from './Term';
import { TermScope } from './TermScope';

const triggers = (name: string) => screen.queryAllByRole('button', { name });

describe('TermScope', () => {
  beforeEach(() => resetStore());

  it('keeps only the first occurrence of a term interactive', () => {
    render(
      <TermScope>
        <p data-testid="a">
          <Term id="hgl">cota</Term>
        </p>
        <p data-testid="b">
          <Term id="hgl">cota</Term> e <Term id="headLoss">perda</Term>
        </p>
      </TermScope>,
    );
    expect(triggers('cota')).toHaveLength(1);
    expect(screen.getByTestId('a')).toContainElement(triggers('cota')[0]!);
    // The repeat is plain text with the same words and no underline class.
    const repeat = screen.getByTestId('b').querySelector('.term--repeat');
    expect(repeat).toHaveTextContent('cota');
    expect(repeat?.querySelector('button')).toBeNull();
    // Another term is counted on its own.
    expect(triggers('perda')).toHaveLength(1);
  });

  it('leaves terms outside a scope and in separate scopes alone', () => {
    render(
      <>
        <Term id="hgl">fora</Term>
        <Term id="hgl">fora</Term>
        <TermScope>
          <Term id="hgl">dentro</Term>
          <TermScope>
            <Term id="hgl">aninhado</Term>
          </TermScope>
        </TermScope>
      </>,
    );
    expect(triggers('fora')).toHaveLength(2);
    expect(triggers('dentro')).toHaveLength(1);
    expect(triggers('aninhado')).toHaveLength(1);
  });

  it('works in strict mode and across re-renders', () => {
    function Panel() {
      const [count, setCount] = useState(0);
      return (
        <TermScope>
          <button type="button" onClick={() => setCount((value) => value + 1)}>
            render {count}
          </button>
          <Term id="hgl">cota</Term>
          <Term id="hgl">cota</Term>
          <Term id="hgl">cota</Term>
        </TermScope>
      );
    }
    render(
      <StrictMode>
        <Panel />
      </StrictMode>,
    );
    expect(triggers('cota')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'render 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'render 1' }));
    expect(triggers('cota')).toHaveLength(1);
    expect(document.querySelectorAll('.term--repeat')).toHaveLength(2);
  });

  it('follows the document order, not the mount order', () => {
    function Panel() {
      const [early, setEarly] = useState(false);
      return (
        <TermScope>
          <button type="button" onClick={() => setEarly((value) => !value)}>
            alternar
          </button>
          <p data-testid="early">{early && <Term id="hgl">cota</Term>}</p>
          <p data-testid="late">
            <Term id="hgl">cota</Term>
          </p>
        </TermScope>
      );
    }
    render(
      <StrictMode>
        <Panel />
      </StrictMode>,
    );
    expect(screen.getByTestId('late')).toContainElement(triggers('cota')[0]!);

    // A term mounted later but earlier on the page takes over.
    fireEvent.click(screen.getByRole('button', { name: 'alternar' }));
    expect(triggers('cota')).toHaveLength(1);
    expect(screen.getByTestId('early')).toContainElement(triggers('cota')[0]!);
    expect(screen.getByTestId('late').querySelector('.term--repeat')).not.toBeNull();

    // When it unmounts, the remaining occurrence is interactive again.
    fireEvent.click(screen.getByRole('button', { name: 'alternar' }));
    expect(triggers('cota')).toHaveLength(1);
    expect(screen.getByTestId('late')).toContainElement(triggers('cota')[0]!);

    // And again after a remount.
    fireEvent.click(screen.getByRole('button', { name: 'alternar' }));
    expect(screen.getByTestId('early')).toContainElement(triggers('cota')[0]!);
  });

  it('opens the tooltip from the wrapper, where the touch area is', () => {
    render(
      <TermScope>
        <Term id="hgl">cota</Term>
      </TermScope>,
    );
    const wrapper = document.querySelector('.term')!;
    fireEvent.pointerDown(wrapper, { pointerType: 'touch' });
    fireEvent.click(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(wrapper, { pointerType: 'touch' });
    fireEvent.click(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
