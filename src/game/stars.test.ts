import { starRating } from './stars';

describe('starRating', () => {
  it('gives no star to a failing design', () => {
    expect(starRating(false, 100, 100)).toBe(0);
  });

  it('rates passing designs by cost relative to the reference', () => {
    expect(starRating(true, 100, 100)).toBe(3);
    expect(starRating(true, 105, 100)).toBe(3);
    expect(starRating(true, 105.01, 100)).toBe(2);
    expect(starRating(true, 125, 100)).toBe(2);
    expect(starRating(true, 125.01, 100)).toBe(1);
    expect(starRating(true, 90, 100)).toBe(3);
  });

  it('gives 3 stars when there is no reference cost', () => {
    expect(starRating(true, 100, 0)).toBe(3);
  });
});
