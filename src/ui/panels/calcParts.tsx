import { useCallback, type ReactNode } from 'react';
import type { CheckSetting, LocalizedText } from '../../engine/types';
import { m3sToLps } from '../../engine/units';
import { useTr } from '../../i18n';
import { useAppStore } from '../../state/store';
import { useNum } from '../network/format';
import { IconCheck, IconError, IconInfo, IconStale, IconWarning } from '../shell/icons';
import type { LinkFlow } from './calcModel';
import { calcStrings as text } from './calcStrings';

const MINUS = '−';

/** Flows below this (m³/s) are shown as no flow. */
export const NO_FLOW = 1e-9;

export interface CalcFormat {
  /** Fixed number of decimals in the current locale, with a real minus sign. */
  num: (value: number, digits?: number) => string;
  /**
   * Like `num`, with thousands split by a thin space: "60.000" next to decimals reads as
   * sixty in pt. For quantities that are not money.
   */
  plain: (value: number, digits?: number) => string;
  /** About `figures` significant figures, never in exponent notation. */
  sig: (value: number, figures?: number) => string;
  /** Mantissa × 10^exponent, for very small or very large constants. */
  sci: (value: number, mantissaDigits?: number) => ReactNode;
}

const GROUP_SEPARATOR = { pt: /\./g, en: /,/g } as const;
const THIN_SPACE = '\u202f';

export function useCalcFormat(): CalcFormat {
  const num = useNum();
  const lang = useAppStore((s) => s.lang);
  const plain = useCallback(
    (value: number, digits = 2) => num(value, digits).replace(GROUP_SEPARATOR[lang], THIN_SPACE),
    [num, lang],
  );
  const sig = useCallback(
    (value: number, figures = 4) => {
      if (!Number.isFinite(value) || value === 0) return plain(value, 2);
      const magnitude = Math.floor(Math.log10(Math.abs(value)));
      return plain(value, Math.min(12, Math.max(0, figures - 1 - magnitude)));
    },
    [plain],
  );
  const sci = useCallback(
    (value: number, mantissaDigits = 3): ReactNode => {
      if (!Number.isFinite(value) || value === 0) return num(value, 0);
      const exponent = Math.floor(Math.log10(Math.abs(value)));
      return (
        <>
          {num(value / 10 ** exponent, mantissaDigits)} × 10
          <sup>{String(exponent).replace('-', MINUS)}</sup>
        </>
      );
    },
    [num],
  );
  return { num, plain, sig, sci };
}

/** One line of a calculation, in the monospace face with tabular digits. */
export function Eq({ children }: { children: ReactNode }) {
  return <p className="calc__eq num">{children}</p>;
}

/** A computed value. `name` lets tests (and styles) find it. */
export function Val({ name, children }: { name: string; children: ReactNode }) {
  return (
    <strong className="calc__value" data-value={name}>
      {children}
    </strong>
  );
}

export function Step({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <li className="calc__step">
      <p className="calc__step-title">{title}</p>
      {children}
    </li>
  );
}

export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface LimitBadgeProps {
  /** True when the value is inside the limit. */
  ok: boolean;
  /** How the stage treats the check that applies to this value. */
  setting: CheckSetting;
  children: string;
}

/** Result of comparing a value with a limit: colour, icon and text. */
export function LimitBadge({ ok, setting, children }: LimitBadgeProps) {
  const tr = useTr();
  if (setting === 'off') {
    return (
      <span className="badge">
        <IconInfo />
        {children} · {tr(text.notRequired)}
      </span>
    );
  }
  if (ok) {
    return (
      <span className="badge badge--ok">
        <IconCheck />
        {children}
      </span>
    );
  }
  return setting === 'warning' ? (
    <span className="badge badge--warn">
      <IconWarning />
      {children}
    </span>
  ) : (
    <span className="badge badge--danger">
      <IconError />
      {children}
    </span>
  );
}

/** Shown in place of the results before the first solve and while they are outdated. */
export function NeedsCalculation() {
  const tr = useTr();
  const solving = useAppStore((s) => s.solving);
  return (
    <p className="calc__notice" role="status">
      <IconStale />
      <span>{tr(solving ? text.solving : text.needsCalculation)}</span>
    </p>
  );
}

/** Links connected to a node or reservoir with the direction and the flow in L/s. */
export function LinkTable({ links, caption }: { links: LinkFlow[]; caption: LocalizedText }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  return (
    <div className="table-wrap">
      <table className="table calc__table">
        <caption className="visually-hidden">{tr(caption)}</caption>
        <thead>
          <tr>
            <th scope="col">{tr(text.link)}</th>
            <th scope="col">{tr(text.direction)}</th>
            <th scope="col" className="num">
              Q (L/s)
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={`${link.kind}-${link.id}`}>
              <th scope="row">
                <span className="num">{link.id}</span>
              </th>
              <td>
                {Math.abs(link.inflow) <= NO_FLOW
                  ? tr(text.still)
                  : tr(link.inflow > 0 ? text.entersFrom(link.other) : text.leavesTo(link.other))}
              </td>
              <td className="num" data-value={`q-${link.id}`}>
                {num(m3sToLps(Math.abs(link.inflow)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
