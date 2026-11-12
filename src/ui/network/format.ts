import { useCallback } from 'react';
import { useFormat } from '../../i18n';

const MINUS = '−';

/**
 * Locale number format (see `useFormat`) with a real minus sign and without "−0,00" for values
 * that round to zero.
 */
export function useNum(): (value: number, digits?: number) => string {
  const fmt = useFormat();
  return useCallback(
    (value: number, digits = 2) => {
      const factor = 10 ** digits;
      const roundsToZero = Math.round(Math.abs(value) * factor) === 0;
      return fmt(roundsToZero ? 0 : value, digits).replace('-', MINUS);
    },
    [fmt],
  );
}
