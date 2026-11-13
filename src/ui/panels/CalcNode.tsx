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
  CalcDetails,
  Eq,
  Fact,
  LimitBadge,
  LinkTable,
  NeedsCalculation,
  Result,
  Results,
  StatusMark,
  Step,
  useCalcFormat,
  Val,
} from './calcParts';
import { calcStrings as text } from './calcStrings';

/** Results of one junction and, behind "Ver cálculo", energy balance, static pressure and continuity. */
export function CalcNode({ node }: { node: ScenarioNode }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const calc = evaluation ? nodeCalc(evaluation, node.id) : null;
  const fresh = calc !== null && !stale;

  return (
    <>
      <Results>
        <Result label={tr(text.demand)} id="demand">
          {num(node.demandLps, 2)} L/s
        </Result>
        {fresh && (
          <>
            <Result label={tr(text.hglAbbr)} name={tr(text.hglFact)} id="hgl">
              {num(calc.head, 2)} m
            </Result>
            <Result
              label={tr(text.pressure)}
              name={tr(text.stepDynamic)}
              id="pressure"
              status={calc.pressureChecked && <DynamicStatus calc={calc} mark />}
            >
              {num(calc.pressure, 2)} {HEAD_UNIT}
            </Result>
          </>
        )}
        {calc?.staticPressure !== undefined && (
          <Result
            label={tr(text.staticShort)}
            name={tr(text.stepStatic)}
            id="static"
            status={calc.pressureChecked && <StaticStatus calc={calc} mark />}
          >
            {num(calc.staticPressure, 2)} {HEAD_UNIT}
          </Result>
        )}
      </Results>

      {!fresh && <NeedsCalculation />}

      <CalcDetails>
        <dl className="calc__facts">
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

        {calc && (
          <ol className="calc__steps">
            {fresh && <DynamicStep calc={calc} />}
            <StaticStep calc={calc} />
            {fresh && <ContinuityStep calc={calc} />}
          </ol>
        )}
        {calc && !calc.pressureChecked && <p className="calc__note">{tr(text.notChecked)}</p>}
      </CalcDetails>
    </>
  );
}

function DynamicStatus({ calc, mark = false }: { calc: NodeCalc; mark?: boolean }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const setting = useAppStore((s) => s.scenario?.checks.minDynamicPressure) ?? 'off';
  const limit = `${num(NBR_CHECK_LIMITS.minDynamicPressure, 0)} ${HEAD_UNIT}`;
  const low = isBelowMinPressure(calc.pressure);
  const Badge = mark ? StatusMark : LimitBadge;
  return (
    <Badge ok={!low} setting={setting}>
      {tr(low ? text.belowMin(limit) : text.within(tr(text.min(limit))))}
    </Badge>
  );
}

function StaticStatus({ calc, mark = false }: { calc: NodeCalc; mark?: boolean }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const setting = useAppStore((s) => s.scenario?.checks.maxStaticPressure) ?? 'off';
  const limit = `${num(NBR_CHECK_LIMITS.maxStaticPressure, 0)} ${HEAD_UNIT}`;
  const high = calc.staticPressure !== undefined && isAboveMaxStatic(calc.staticPressure);
  const Badge = mark ? StatusMark : LimitBadge;
  return (
    <Badge ok={!high} setting={setting}>
      {tr(high ? text.aboveMax(limit) : text.within(tr(text.max(limit))))}
    </Badge>
  );
}

function DynamicStep({ calc }: { calc: NodeCalc }) {
  const tr = useTr();
  const { num } = useCalcFormat();
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
          <DynamicStatus calc={calc} />
        </p>
      )}
    </Step>
  );
}

function StaticStep({ calc }: { calc: NodeCalc }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  if (calc.staticPressure === undefined || calc.staticLevel === undefined) return null;
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
          <StaticStatus calc={calc} />
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
