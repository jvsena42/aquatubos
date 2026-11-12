import { useCallback } from 'react';
import type { LocalizedText } from '../engine/types';
import { useAppStore } from '../state/store';

export type { Lang } from '../persistence/db';

/**
 * Returns a function that picks the current language from a `{ pt, en }` pair.
 * UI strings live next to the components that use them, as LocalizedText objects.
 */
export function useTr(): (text: LocalizedText) => string {
  const lang = useAppStore((s) => s.lang);
  return useCallback((text: LocalizedText) => text[lang], [lang]);
}

const LOCALES = { pt: 'pt-BR', en: 'en-US' } as const;

/** Number formatting with the decimal separator of the current language. */
export function useFormat(): (value: number, digits?: number) => string {
  const lang = useAppStore((s) => s.lang);
  return useCallback(
    (value: number, digits = 2) =>
      Number.isFinite(value)
        ? value.toLocaleString(LOCALES[lang], {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          })
        : '–',
    [lang],
  );
}
