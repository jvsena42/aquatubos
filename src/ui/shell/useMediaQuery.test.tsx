import { act, render, screen } from '@testing-library/react';
import { mockMatchMedia, type MatchMediaMock } from './testMatchMedia';
import { PHONE_LANDSCAPE_QUERY, PHONE_QUERY, useMediaQuery } from './useMediaQuery';

function Probe({ query }: { query: string }) {
  return <p>{useMediaQuery(query) ? 'yes' : 'no'}</p>;
}

describe('useMediaQuery', () => {
  let media: MatchMediaMock | null = null;
  afterEach(() => {
    media?.restore();
    media = null;
  });

  it('is false where matchMedia does not exist', () => {
    render(<Probe query={PHONE_QUERY} />);
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('follows the query as it starts and stops matching', () => {
    media = mockMatchMedia((query) => query === PHONE_QUERY);
    render(<Probe query={PHONE_QUERY} />);
    expect(screen.getByText('yes')).toBeInTheDocument();
    act(() => media?.set(() => false));
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('counts a phone held sideways as a phone', () => {
    expect(PHONE_QUERY).toContain(PHONE_LANDSCAPE_QUERY);
    expect(PHONE_QUERY).toContain('(max-width: 760px)');
  });
});
