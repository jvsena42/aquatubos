import { lpsToM3s, m3sToLps, mmToM, mToMm, pipeArea, velocity } from './units';

describe('units', () => {
  it('converts flow and length', () => {
    expect(lpsToM3s(12)).toBeCloseTo(0.012, 12);
    expect(m3sToLps(0.012)).toBeCloseTo(12, 12);
    expect(mmToM(150)).toBeCloseTo(0.15, 12);
    expect(mToMm(0.15)).toBeCloseTo(150, 12);
  });

  it('computes area and velocity', () => {
    expect(pipeArea(0.1)).toBeCloseTo(0.00785398, 8);
    // 10 L/s in DN100: v = 0.010 / 0.00785398 = 1.2732 m/s
    expect(velocity(0.01, 0.1)).toBeCloseTo(1.2732, 4);
    expect(velocity(-0.01, 0.1)).toBeCloseTo(-1.2732, 4);
  });
});
