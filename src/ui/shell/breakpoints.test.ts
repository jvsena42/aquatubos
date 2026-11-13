import { renderHook } from '@testing-library/react';
import {
  classifyDevice,
  LANDSCAPE_QUERY,
  PHONE_QUERY,
  UP_TO_TABLET_QUERY,
  useDevice,
  useDeviceAttributes,
} from './breakpoints';

function mockMatchMedia(matches: (query: string) => boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: matches(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('breakpoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.device;
    delete document.documentElement.dataset.orientation;
  });

  it('classifies phone before tablet before desktop', () => {
    expect(classifyDevice(true, true)).toBe('phone');
    // A phone held sideways can be wider than the tablet limit and is still a phone.
    expect(classifyDevice(true, false)).toBe('phone');
    expect(classifyDevice(false, true)).toBe('tablet');
    expect(classifyDevice(false, false)).toBe('desktop');
  });

  it('is desktop where matchMedia does not exist', () => {
    expect(renderHook(() => useDevice()).result.current).toBe('desktop');
  });

  it('reads the device from the shared queries', () => {
    mockMatchMedia((query) => query === UP_TO_TABLET_QUERY);
    expect(renderHook(() => useDevice()).result.current).toBe('tablet');
    mockMatchMedia((query) => query === PHONE_QUERY || query === UP_TO_TABLET_QUERY);
    expect(renderHook(() => useDevice()).result.current).toBe('phone');
  });

  it('mirrors device and orientation on the root element', () => {
    mockMatchMedia((query) => query === UP_TO_TABLET_QUERY || query === LANDSCAPE_QUERY);
    renderHook(() => useDeviceAttributes());
    expect(document.documentElement.dataset.device).toBe('tablet');
    expect(document.documentElement.dataset.orientation).toBe('landscape');
  });
});
