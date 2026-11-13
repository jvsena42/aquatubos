import { DETAIL_MID_SCALE, DETAIL_NEAR_SCALE, detailClass, detailLevel } from './detail';

describe('detail budget of the town', () => {
  it('draws the least at the scale of a town fitted on a phone', () => {
    // Stage 4 fitted in 360 px: about 0.3 px per metre.
    expect(detailLevel(0.3)).toBe('far');
    expect(detailClass(0.3)).toBe('town--detail-far');
  });

  it('changes level at the thresholds', () => {
    expect(detailLevel(DETAIL_MID_SCALE - 0.001)).toBe('far');
    expect(detailLevel(DETAIL_MID_SCALE)).toBe('mid');
    expect(detailLevel(DETAIL_NEAR_SCALE - 0.001)).toBe('mid');
    expect(detailLevel(DETAIL_NEAR_SCALE)).toBe('near');
    expect(detailClass(2)).toBe('town--detail-near');
  });
});
