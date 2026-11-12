import catalog from './data/pipeCatalog.json';
import {
  catalogEntry,
  COMMERCIAL_DNS,
  networkCost,
  PIPE_CATALOG,
  PIPE_CATALOG_CURRENCY,
  PIPE_CATALOG_NOTE,
  pipeCost,
} from './cost';

describe('pipe catalog', () => {
  it('lists the commercial diameters in ascending order', () => {
    expect(COMMERCIAL_DNS).toEqual([50, 75, 100, 150, 200, 250, 300]);
    expect(PIPE_CATALOG.map((p) => p.dn)).toEqual([...COMMERCIAL_DNS]);
  });

  it('takes the internal diameter equal to the nominal diameter', () => {
    for (const pipe of PIPE_CATALOG) {
      expect(pipe.internalDiameterMm).toBe(pipe.dn);
    }
  });

  it('uses only PVC and PEAD', () => {
    for (const pipe of PIPE_CATALOG) {
      expect(['PVC', 'PEAD']).toContain(pipe.material);
    }
    expect(catalogEntry(50).material).toBe('PVC');
    expect(catalogEntry(100).material).toBe('PVC');
    expect(catalogEntry(300).material).toBe('PEAD');
  });

  it('has prices that increase with DN along a convex curve', () => {
    const slopes: number[] = [];
    for (let i = 1; i < PIPE_CATALOG.length; i++) {
      const previous = PIPE_CATALOG[i - 1]!;
      const current = PIPE_CATALOG[i]!;
      expect(current.pricePerMeter).toBeGreaterThan(previous.pricePerMeter);
      slopes.push((current.pricePerMeter - previous.pricePerMeter) / (current.dn - previous.dn));
    }
    for (let i = 1; i < slopes.length; i++) {
      expect(slopes[i]!).toBeGreaterThan(slopes[i - 1]!);
    }
    expect(catalogEntry(50).pricePerMeter).toBeCloseTo(25, 6);
    expect(catalogEntry(300).pricePerMeter).toBeCloseTo(400, 6);
  });

  it('states that the prices are illustrative and not SINAPI prices', () => {
    expect(catalog.note).toMatch(/not actual SINAPI prices/);
    expect(catalog.note).toMatch(/Não são preços reais do SINAPI/);
    expect(PIPE_CATALOG_NOTE).toBe(catalog.note);
    expect(PIPE_CATALOG_CURRENCY).toBe('BRL');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PIPE_CATALOG)).toBe(true);
    expect(Object.isFrozen(PIPE_CATALOG[0])).toBe(true);
    expect(Object.isFrozen(COMMERCIAL_DNS)).toBe(true);
  });
});

describe('catalogEntry', () => {
  it('returns the entry of a DN', () => {
    expect(catalogEntry(150)).toEqual({
      dn: 150,
      internalDiameterMm: 150,
      material: 'PEAD',
      pricePerMeter: 120,
    });
  });

  it('throws for a DN that is not commercial', () => {
    expect(() => catalogEntry(60)).toThrow(/DN 60 is not in the pipe catalog/);
  });
});

describe('pipeCost', () => {
  it('multiplies the price per metre by the length', () => {
    // DN 100: 65 R$/m × 120 m = 7800 R$
    expect(pipeCost(100, 120)).toBe(7800);
    // DN 50: 25 R$/m × 80.5 m = 2012.50 R$
    expect(pipeCost(50, 80.5)).toBe(2012.5);
    expect(pipeCost(300, 0)).toBe(0);
  });

  it('rounds to cents', () => {
    // DN 75: 42 R$/m × 10.333 m = 433.986 → 433.99
    expect(pipeCost(75, 10.333)).toBe(433.99);
  });

  it('rejects invalid lengths and unknown diameters', () => {
    expect(() => pipeCost(100, -1)).toThrow(RangeError);
    expect(() => pipeCost(100, Number.NaN)).toThrow(RangeError);
    expect(() => pipeCost(110, 10)).toThrow(/not in the pipe catalog/);
  });
});

describe('networkCost', () => {
  it('sums the cost of every pipe', () => {
    // 100 m DN 50 = 2500; 200 m DN 100 = 13000; 50 m DN 200 = 9750 → 25250
    expect(
      networkCost([
        { dn: 50, length: 100 },
        { dn: 100, length: 200 },
        { dn: 200, length: 50 },
      ]),
    ).toBe(25250);
  });

  it('is zero for an empty list', () => {
    expect(networkCost([])).toBe(0);
  });

  it('throws when a pipe has a DN outside the catalog', () => {
    expect(() =>
      networkCost([
        { dn: 50, length: 10 },
        { dn: 33, length: 10 },
      ]),
    ).toThrow();
  });
});
