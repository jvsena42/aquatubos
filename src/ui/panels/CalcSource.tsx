import { fitPumpCurve } from '../../engine/pump';
import type { PumpCurve, PumpCurvePoint } from '../../engine/types';
import { lpsToM3s, m3sToLps } from '../../engine/units';
import { useTr } from '../../i18n';
import type { ScenarioPump, ScenarioReservoir } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { Term } from '../glossary/Term';
import { pumpCalc, reservoirCalc } from './calcModel';
import { Eq, Fact, LinkTable, NeedsCalculation, Step, useCalcFormat, Val } from './calcParts';
import { calcStrings as text } from './calcStrings';

/** Water level and flow supplied by a reservoir. */
export function CalcReservoir({ reservoir }: { reservoir: ScenarioReservoir }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const calc = evaluation && !stale ? reservoirCalc(evaluation, reservoir.id) : null;

  return (
    <>
      <dl className="calc__facts">
        <Fact label={tr(text.waterLevel)}>
          <span className="num">
            <Val name="level">{num(reservoir.waterLevel, 2)} m</Val>
          </span>
        </Fact>
        <Fact label={tr(text.elevation)}>
          <span className="num">{num(reservoir.elevation, 2)} m</span>
        </Fact>
        {calc && (
          <Fact label={tr(text.supplied)}>
            <span className="num">
              <Val name="outflow">{num(m3sToLps(calc.outflow), 2)} L/s</Val>
            </span>
          </Fact>
        )}
      </dl>
      <p className="calc__note">{tr(text.reservoirNote)}</p>
      {calc ? <LinkTable links={calc.links} caption={text.links} /> : <NeedsCalculation />}
    </>
  );
}

function curveOf(pump: ScenarioPump): PumpCurve | null {
  try {
    return fitPumpCurve(
      pump.points.map((point) => ({ flow: lpsToM3s(point.flowLps), head: point.head })) as [
        PumpCurvePoint,
        PumpCurvePoint,
        PumpCurvePoint,
      ],
    );
  } catch {
    return null;
  }
}

/** Fitted curve of a pump and its operating point. */
export function CalcPump({ pump }: { pump: ScenarioPump }) {
  const tr = useTr();
  const { num, sig } = useCalcFormat();
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);
  const calc = evaluation && !stale ? pumpCalc(evaluation, pump.id) : null;
  const curve = calc?.curve ?? curveOf(pump);
  const hgl = tr(text.hglAbbr);

  return (
    <>
      <dl className="calc__facts">
        <Fact label={tr(text.pumpEnds)}>
          <span className="num">
            {pump.from} → {pump.to}
          </span>
        </Fact>
        <Fact label={tr(text.cataloguePoints)}>
          <ul className="calc__points num">
            {pump.points.map((point, index) => (
              <li key={index}>
                Q = {num(point.flowLps, 1)} L/s, H = {num(point.head, 1)} m
              </li>
            ))}
          </ul>
        </Fact>
      </dl>

      <ol className="calc__steps">
        {curve && (
          <Step title={<Term id="pumpCurve">{tr(text.stepCurve)}</Term>}>
            <Eq>
              H = a − b × Q<sup>c</sup>
            </Eq>
            <Eq>
              a = <Val name="a">{num(curve.a, 2)}</Val>, b = <Val name="b">{sig(curve.b, 5)}</Val>,
              c = <Val name="c">{num(curve.c, 3)}</Val>
            </Eq>
            <p className="calc__note">{tr(text.curveNote)}</p>
          </Step>
        )}
        {calc && (
          <>
            <Step title={<Term id="operatingPoint">{tr(text.stepOperating)}</Term>}>
              <Eq>
                Q = <Val name="q">{num(m3sToLps(calc.flow), 2)} L/s</Val> = {num(calc.flow, 5)} m³/s
              </Eq>
              <Eq>
                H = {num(calc.curve.a, 2)} − {sig(calc.curve.b, 5)} × {num(calc.flow, 5)}
                <sup>{num(calc.curve.c, 3)}</sup> = <Val name="h">{num(calc.head, 2)} m</Val>
              </Eq>
            </Step>
            <Step title={tr(text.stepPumpEnergy)}>
              <Eq>
                {hgl}
                <sub>{calc.to}</sub> = {hgl}
                <sub>{calc.from}</sub> + H = {num(calc.suctionHead, 2)} + {num(calc.head, 2)} ={' '}
                <Val name="hgl-discharge">{num(calc.dischargeHead, 2)} m</Val>
              </Eq>
            </Step>
          </>
        )}
      </ol>
      {!calc && <NeedsCalculation />}
    </>
  );
}
