import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { m3sToLps } from '../../engine/units';
import { useTr } from '../../i18n';
import type { ScenarioNode } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { Term } from '../glossary/Term';
import { isAboveMaxStatic, isBelowMinPressure } from '../network/status';
import { HEAD_UNIT } from '../network/strings';
import { nodeCalc, type NodeCalc } from './calcModel';
import {
  Eq,
  Fact,
  LimitBadge,
  LinkTable,
  NeedsCalculation,
  Step,
  useCalcFormat,
  Val,
} from './calcParts';
import { calcStrings as text } from './calcStrings';

/** Energy balance, static pressure and continuity of one junction. */
export function CalcNode({ node }: { node: ScenarioNode }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const calc = evaluation ? nodeCalc(evaluation, node.id) : null;
  const fresh = calc !== null && !stale;

  return (
    <>
      <dl className="calc__facts">
        <Fact label={tr(text.demand)}>
          <span className="num">{num(node.demandLps, 2)} L/s</span>
        </Fact>
        <Fact label={tr(text.elevation)}>
          <span className="num">z = {num(node.elevation, 2)} m</span>
        </Fact>
        {fresh && (
          <Fact label={<Term id="hgl">{tr(text.hglFact)}</Term>}>
            <span className="num">
              {tr(text.hglAbbr)} = <Val name="hgl">{num(calc.head, 2)} m</Val>
            </span>
          </Fact>
        )}
      </dl>

      {!fresh && <NeedsCalculation />}

      {calc && (
        <ol className="calc__steps">
          {fresh && <DynamicStep calc={calc} />}
          <StaticStep calc={calc} />
          {fresh && <ContinuityStep calc={calc} />}
        </ol>
      )}
      {calc && !calc.pressureChecked && <p className="calc__note">{tr(text.notChecked)}</p>}
    </>
  );
}

function DynamicStep({ calc }: { calc: NodeCalc }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const setting = useAppStore((s) => s.scenario?.checks.minDynamicPressure) ?? 'off';
  const limit = `${num(NBR_CHECK_LIMITS.minDynamicPressure, 0)} ${HEAD_UNIT}`;
  const low = isBelowMinPressure(calc.pressure);
  return (
    <Step title={<Term id="dynamicPressure">{tr(text.stepDynamic)}</Term>}>
      <p className="calc__note">{tr(text.pressureEq)}</p>
      <Eq>
        p = {tr(text.hglAbbr)} − z = {num(calc.head, 2)} − {num(calc.elevation, 2)} ={' '}
        <Val name="pressure">
          {num(calc.pressure, 2)} {HEAD_UNIT}
        </Val>
      </Eq>
      {calc.pressureChecked && (
        <p className="calc__status">
          <LimitBadge ok={!low} setting={setting}>
            {tr(low ? text.belowMin(limit) : text.within(tr(text.min(limit))))}
          </LimitBadge>
        </p>
      )}
    </Step>
  );
}

function StaticStep({ calc }: { calc: NodeCalc }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const setting = useAppStore((s) => s.scenario?.checks.maxStaticPressure) ?? 'off';
  if (calc.staticPressure === undefined || calc.staticLevel === undefined) return null;
  const limit = `${num(NBR_CHECK_LIMITS.maxStaticPressure, 0)} ${HEAD_UNIT}`;
  const high = isAboveMaxStatic(calc.staticPressure);
  return (
    <Step title={<Term id="staticPressure">{tr(text.stepStatic)}</Term>}>
      <p className="calc__note">{tr(text.staticEq)}</p>
      <Eq>
        p<sub>est</sub> = {num(calc.staticLevel, 2)} − {num(calc.elevation, 2)} ={' '}
        <Val name="static">
          {num(calc.staticPressure, 2)} {HEAD_UNIT}
        </Val>
      </Eq>
      {calc.pressureChecked && (
        <p className="calc__status">
          <LimitBadge ok={!high} setting={setting}>
            {tr(high ? text.aboveMax(limit) : text.within(tr(text.max(limit))))}
          </LimitBadge>
        </p>
      )}
      <p className="calc__note">{tr(text.staticNote)}</p>
    </Step>
  );
}

function ContinuityStep({ calc }: { calc: NodeCalc }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  return (
    <Step title={tr(text.stepContinuity)}>
      <LinkTable links={calc.links} caption={text.stepContinuity} />
      <p className="calc__note">{tr(text.continuityEq)}</p>
      <Eq>
        {num(m3sToLps(calc.inflow), 2)} − {num(m3sToLps(calc.outflow), 2)} −{' '}
        {num(m3sToLps(calc.demand), 2)} ={' '}
        <Val name="continuity">{num(m3sToLps(calc.residual), 2)} L/s</Val>
      </Eq>
    </Step>
  );
}
