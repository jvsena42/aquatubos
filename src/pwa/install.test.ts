import { act, renderHook } from '@testing-library/react';
import {
  detectIos,
  detectStandalone,
  initPwaInstall,
  installMode,
  promptInstall,
  resetPwaInstall,
  usePwaInstall,
  type BeforeInstallPromptEvent,
} from './install';

function promptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('detectIos', () => {
  const nav = (userAgent: string, platform = '', maxTouchPoints = 0) => ({
    userAgent,
    platform,
    maxTouchPoints,
  });

  it('recognises iPhone and iPad user agents', () => {
    expect(detectIos(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe(true);
    expect(detectIos(nav('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'))).toBe(true);
  });

  it('recognises iPadOS reporting as a Mac with a touch screen', () => {
    expect(detectIos(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5))).toBe(
      true,
    );
  });

  it('does not take a real Mac, Android or Windows for iOS', () => {
    expect(detectIos(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0))).toBe(
      false,
    );
    expect(detectIos(nav('Mozilla/5.0 (Linux; Android 14; Pixel 7)', 'Linux armv8l', 5))).toBe(
      false,
    );
    expect(detectIos(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10))).toBe(false);
  });
});

describe('detectStandalone', () => {
  const nav = { userAgent: '', platform: '', maxTouchPoints: 0 };
  const media = (matches: boolean) =>
    ({ matchMedia: () => ({ matches }) }) as unknown as Pick<Window, 'matchMedia'>;

  it('uses the display-mode media query', () => {
    expect(detectStandalone(media(true), nav)).toBe(true);
    expect(detectStandalone(media(false), nav)).toBe(false);
  });

  it('uses navigator.standalone on iOS', () => {
    expect(detectStandalone(media(false), { ...nav, standalone: true })).toBe(true);
  });

  it('is false where matchMedia does not exist', () => {
    expect(detectStandalone({} as Pick<Window, 'matchMedia'>, nav)).toBe(false);
  });
});

describe('installMode', () => {
  const base = { deferred: null, installed: false, standalone: false, ios: false };

  it('prefers the native prompt, then iOS instructions, otherwise nothing', () => {
    expect(installMode(base)).toBe('none');
    expect(installMode({ ...base, ios: true })).toBe('ios');
    expect(installMode({ ...base, deferred: promptEvent('accepted') })).toBe('prompt');
    expect(installMode({ ...base, ios: true, deferred: promptEvent('accepted') })).toBe('prompt');
  });

  it('is none when installed or running standalone', () => {
    expect(installMode({ ...base, ios: true, standalone: true })).toBe('none');
    expect(installMode({ ...base, deferred: promptEvent('accepted'), installed: true })).toBe(
      'none',
    );
  });
});

describe('usePwaInstall', () => {
  beforeEach(() => {
    resetPwaInstall();
    initPwaInstall();
  });

  it('captures beforeinstallprompt, prevents the default banner and prompts on demand', async () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.mode).toBe('none');
    expect(result.current.canPrompt).toBe(false);
    expect(await promptInstall()).toBe('unavailable');

    const event = promptEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.mode).toBe('prompt');
    expect(result.current.canPrompt).toBe(true);

    let outcome = '';
    await act(async () => {
      outcome = await result.current.promptInstall();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(result.current.installed).toBe(true);
    expect(result.current.mode).toBe('none');
  });

  it('drops the prompt after a dismissal: the event cannot be reused', async () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(promptEvent('dismissed'));
    });
    await act(async () => {
      expect(await result.current.promptInstall()).toBe('dismissed');
    });
    expect(result.current.installed).toBe(false);
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.mode).toBe('none');
  });

  it('hides everything after appinstalled', () => {
    const { result } = renderHook(() => usePwaInstall());
    act(() => {
      window.dispatchEvent(promptEvent('accepted'));
    });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.mode).toBe('none');
  });

  it('listens only once even when initialised twice', () => {
    const spy = vi.spyOn(window, 'addEventListener');
    initPwaInstall();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
