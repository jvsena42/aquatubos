import { act, renderHook } from '@testing-library/react';
import { PHONE_QUERY } from '../shell/breakpoints';
import { COARSE_QUERY, SMALL_QUERY, useViewProfile, viewProfile } from './viewProfile';

describe('viewProfile', () => {
  it('keeps the full budget and a 2× pixel ratio on a desktop', () => {
    expect(viewProfile({ coarse: false, small: false })).toEqual({
      touch: false,
      compact: false,
      quality: 'high',
      maxDpr: 2,
      clickSlop: 5,
      hitScale: 1,
    });
  });

  it('caps the pixel ratio at 1.5 and lowers the budget on a phone', () => {
    expect(viewProfile({ coarse: true, small: true })).toEqual({
      touch: true,
      compact: true,
      quality: 'low',
      maxDpr: 1.5,
      clickSlop: 10,
      hitScale: 1.8,
    });
  });

  it('treats a tablet as touch with the low budget but the full layout', () => {
    const tablet = viewProfile({ coarse: true, small: false });
    expect(tablet).toMatchObject({ touch: true, compact: false, quality: 'low', maxDpr: 1.5 });
    expect(tablet.hitScale).toBeGreaterThan(1);
  });

  it('gives a narrow window with a mouse the compact layout and mouse-sized targets', () => {
    expect(viewProfile({ coarse: false, small: true })).toMatchObject({
      touch: false,
      compact: true,
      quality: 'low',
      maxDpr: 1.5,
      clickSlop: 5,
      hitScale: 1,
    });
  });
});

describe('useViewProfile', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Installs a matchMedia whose answers can be changed, notifying the listeners. */
  function stubMedia(initial: Record<string, boolean>) {
    const state = { ...initial };
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return state[query] ?? false;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }));
    return {
      set(query: string, value: boolean) {
        state[query] = value;
        for (const listener of [...listeners]) listener();
      },
      listeners,
    };
  }

  it('is the desktop profile where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useViewProfile());
    expect(result.current).toEqual(viewProfile({ coarse: false, small: false }));
  });

  it('reads the pointer and the screen size from the media queries', () => {
    stubMedia({ [COARSE_QUERY]: true, [SMALL_QUERY]: true });
    const { result } = renderHook(() => useViewProfile());
    expect(result.current).toEqual(viewProfile({ coarse: true, small: true }));
  });

  it('follows a rotation or resize and returns a stable object in between', () => {
    const media = stubMedia({ [COARSE_QUERY]: true, [SMALL_QUERY]: true });
    const { result, rerender, unmount } = renderHook(() => useViewProfile());
    const phone = result.current;
    rerender();
    expect(result.current).toBe(phone);

    act(() => media.set(SMALL_QUERY, false));
    expect(result.current).toEqual(viewProfile({ coarse: true, small: false }));

    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('uses the shared phone breakpoint for the small profile', () => {
    expect(SMALL_QUERY).toBe(PHONE_QUERY);
  });
});
