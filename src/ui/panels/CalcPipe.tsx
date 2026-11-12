import { NBR_CHECK_LIMITS } from '../../engine/config/nbr12218';
import { catalogEntry, pipeCost } from '../../engine/cost';
import {
  HAZEN_WILLIAMS_CONSTANT,
  HAZEN_WILLIAMS_DIAMETER_EXPONENT,
  HAZEN_WILLIAMS_EXPONENT,
} from '../../engine/headloss';
import type { CheckSetting } from '../../engine/types';
import { GRAVITY, m3sToLps, mToMm, WATER_KINEMATIC_VISCOSITY } from '../../engine/units';
import { useTr } from '../../i18n';
import type { ScenarioPipe } from '../../scenarios/types';
import { useAppStore } from '../../state/store';
import { Term } from '../glossary/Term';
import { DnPicker } from '../network/DnPicker';
import { classifyVelocity } from '../network/status';
import { money } from '../shell/strings';
import { pipeCalc, type PipeCalc } from './calcModel';
import {
  Eq,
  Fact,
  LimitBadge,
  NeedsCalculation,
  NO_FLOW,
  Step,
  useCalcFormat,
  Val,
} from './calcParts';
import { calcStrings as text, regimeLabels } from './calcStrings';

/** Diameter picker, data and hand-checkable head loss calculation of one pipe. */
export function CalcPipe({ pipe }: { pipe: ScenarioPipe }) {
  const tr = useTr();
  const { num } = useCalcFormat();
  const scenario = useAppStore((s) => s.scenario);
  const diameters = useAppStore((s) => s.diameters);
  const formula = useAppStore((s) => s.formula);
  const evaluation = useAppStore((s) => s.evaluation);
  const stale = useAppStore((s) => s.stale);

  if (!scenario) return null;
  const dn = diameters[pipe.id] ?? pipe.initialDN;
  const entry = catalogEntry(dn);
  const calc = evaluation && !stale ? pipeCalc(evaluation, pipe.id) : null;

  return (
    <>
      <div className="field">
        <span className="field__label">
          <Term id="dn">{tr(text.diameter)}</Term> (DN, mm)
        </span>
        <DnPicker pipeId={pipe.id} />
      </div>

      <dl className="calc__facts">
        <Fact label={tr(text.ends)}>
          <span className="num">
            {pipe.from} → {pipe.to}
          </span>
        </Fact>
        <Fact label={tr(text.length)}>
          <span className="num">L = {num(pipe.length, 0)} m</span>
        </Fact>
        <Fact label={tr(text.material)}>
          <span className="num">
            {entry.material}, D = {num(entry.internalDiameterMm, 0)} mm
          </span>
        </Fact>
        {formula === 'hazen-williams' ? (
          <Fact label={<Term id="hazenWilliamsC">{tr(text.roughnessHw)}</Term>}>
            <span className="num">C = {num(scenario.hazenWilliamsC, 0)}</span>
          </Fact>
        ) : (
          <Fact label={<Term id="roughness">{tr(text.roughnessDw)}</Term>}>
            <span className="num">ε = {num(scenario.roughnessMm, 4)} mm</span>
          </Fact>
        )}
        <Fact label={tr(text.cost)}>
          <span className="num">
            {money(num(entry.pricePerMeter, 2))}/m × {num(pipe.length, 0)} m ={' '}
            <Val name="cost">{money(num(pipeCost(dn, pipe.length), 2))}</Val>
          </span>
        </Fact>
      </dl>

      {calc ? <PipeSteps calc={calc} /> : <NeedsCalculation />}
    </>
  );
}

function PipeSteps({ calc }: { calc: PipeCalc }) {
  const tr = useTr();
  const { num, plain, sig, sci } = useCalcFormat();
  const checks = useAppStore((s) => s.scenario?.checks);
  const limits = NBR_CHECK_LIMITS;

  const q = num(calc.flow, 5);
  const d = num(calc.diameter, 3);
  const area = sig(calc.area, 4);
  const v = num(calc.velocity, 3);
  const length = num(calc.length, 0);
  const hf = num(calc.headLoss, 3);
  const j = sig(calc.unitHeadLoss, 4);
  const exponentQ = num(HAZEN_WILLIAMS_EXPONENT, 3);
  const exponentD = num(HAZEN_WILLIAMS_DIAMETER_EXPONENT, 2);
  const k = num(HAZEN_WILLIAMS_CONSTANT, 3);
  const c = num(calc.hazenWilliamsC, 0);
  const hgl = tr(text.hglAbbr);

  const velocityStatus = classifyVelocity(calc.velocity);
  const minLimit = `${num(limits.minVelocity, 1)} m/s`;
  const maxLimit = `${num(limits.maxVelocity, 1)} m/s`;
  const minSetting: CheckSetting = checks?.minVelocity ?? 'off';
  const maxSetting: CheckSetting = checks?.maxVelocity ?? 'off';
  const velocityBadge =
    velocityStatus === 'low' ? (
      <LimitBadge ok={false} setting={minSetting}>
        {tr(text.belowMin(minLimit))}
      </LimitBadge>
    ) : velocityStatus === 'high' ? (
      <LimitBadge ok={false} setting={maxSetting}>
        {tr(text.aboveMax(maxLimit))}
      </LimitBadge>
    ) : (
      <LimitBadge ok setting={minSetting === 'off' && maxSetting === 'off' ? 'off' : 'error'}>
        {tr(text.within(tr(text.range(num(limits.minVelocity, 1), maxLimit))))}
      </LimitBadge>
    );

  const unitLossValues = (
    <>
      <Val name="j">{j} m/m</Val> = {num(calc.unitHeadLoss * 1000, 3)} m/km
    </>
  );

  return (
    <section className="calc__section">
      <h4 className="calc__subtitle">{tr(text.calculation)}</h4>
      <p className="calc__note">
        {calc.flow <= NO_FLOW
          ? tr(text.noFlow)
          : tr(
              calc.reversed
                ? text.flowReversed(calc.upstream, calc.downstream)
                : text.flowDirection(calc.upstream, calc.downstream),
            )}
      </p>
      <ol className="calc__steps">
        <Step title={<Term id="flow">{tr(text.stepFlow)}</Term>}>
          <Eq>
            Q = <Val name="q">{num(m3sToLps(calc.flow), 2)} L/s</Val> = {q} m³/s
          </Eq>
        </Step>

        <Step title={tr(text.stepArea)}>
          <Eq>
            A = π × D<sup>2</sup> / 4 = π × {d}
            <sup>2</sup> / 4 = <Val name="area">{area} m²</Val>
          </Eq>
          <Eq>
            D = {num(mToMm(calc.diameter), 0)} mm = {d} m
          </Eq>
        </Step>

        <Step title={tr(text.stepVelocity)}>
          <Eq>
            V = Q / A = {q} / {area} = <Val name="v">{v} m/s</Val>
          </Eq>
          <p className="calc__status">{velocityBadge}</p>
        </Step>

        {calc.formula === 'hazen-williams' ? (
          <>
            <Step title={<Term id="unitHeadLoss">{tr(text.stepUnitLoss)}</Term>}>
              <Eq>
                J = {k} × Q<sup>{exponentQ}</sup> / (C<sup>{exponentQ}</sup> × D
                <sup>{exponentD}</sup>)
              </Eq>
              <Eq>
                J = {k} × {q}
                <sup>{exponentQ}</sup> / ({c}
                <sup>{exponentQ}</sup> × {d}
                <sup>{exponentD}</sup>)
              </Eq>
              <Eq>J = {unitLossValues}</Eq>
              <p className="calc__note">{tr(text.hazenWilliams)}</p>
            </Step>
            <Step title={<Term id="headLoss">{tr(text.stepHeadLoss)}</Term>}>
              <Eq>
                h<sub>f</sub> = J × L = {j} × {length} = <Val name="hf">{hf} m</Val>
              </Eq>
            </Step>
          </>
        ) : (
          <>
            <Step title={<Term id="reynolds">{tr(text.stepReynolds)}</Term>}>
              <Eq>
                Re = V × D / ν = {v} × {d} / ({sci(WATER_KINEMATIC_VISCOSITY)}) ={' '}
                <Val name="re">{plain(calc.reynolds ?? 0, 0)}</Val>
              </Eq>
              <p className="calc__note">
                {tr(text.viscosity)} ({sci(WATER_KINEMATIC_VISCOSITY)} m²/s)
              </p>
            </Step>
            <Step title={<Term id="roughness">{tr(text.stepRelativeRoughness)}</Term>}>
              <Eq>
                ε / D = {num(mToMm(calc.roughness), 4)} mm / {num(mToMm(calc.diameter), 0)} mm ={' '}
                <Val name="rr">{sig(calc.relativeRoughness ?? 0, 3)}</Val>
              </Eq>
            </Step>
            <Step title={<Term id="frictionFactor">{tr(text.stepFriction)}</Term>}>
              {calc.regime === 'laminar' ? (
                <Eq>
                  f = 64 / Re = <Val name="f">{num(calc.frictionFactor ?? 0, 4)}</Val>
                </Eq>
              ) : (
                <>
                  {calc.regime === 'turbulent' && (
                    <Eq>
                      1 / √f = −2 × log<sub>10</sub>[ε / ({num(3.7, 1)} × D) + {num(2.51, 2)} / (Re
                      × √f)]
                    </Eq>
                  )}
                  <Eq>
                    f = <Val name="f">{num(calc.frictionFactor ?? 0, 4)}</Val>
                  </Eq>
                </>
              )}
              <p className="calc__note">{tr(regimeLabels[calc.regime ?? 'turbulent'])}</p>
            </Step>
            <Step title={<Term id="headLoss">{tr(text.stepHeadLoss)}</Term>}>
              <Eq>
                h<sub>f</sub> = f × (L / D) × V<sup>2</sup> / (2g)
              </Eq>
              <Eq>
                h<sub>f</sub> = {num(calc.frictionFactor ?? 0, 4)} × ({length} / {d}) × {v}
                <sup>2</sup> / (2 × {num(GRAVITY, 5)}) = <Val name="hf">{hf} m</Val>
              </Eq>
              <Eq>
                J = h<sub>f</sub> / L = {hf} / {length} = {unitLossValues}
              </Eq>
            </Step>
          </>
        )}

        <Step title={tr(text.stepEnergy)}>
          <p className="calc__note">
            <Term id="hgl">{tr(text.hgl)}</Term> ({hgl}): {hgl} {tr(text.downstream)} = {hgl}{' '}
            {tr(text.upstream)} − h<sub>f</sub>
          </p>
          <Eq>
            {hgl}
            <sub>{calc.downstream}</sub> = {hgl}
            <sub>{calc.upstream}</sub> − h<sub>f</sub> = {num(calc.upstreamHead, 2)} − {hf} ={' '}
            <Val name="hgl-down">{num(calc.downstreamHead, 2)} m</Val>
          </Eq>
        </Step>
      </ol>
    </section>
  );
}
