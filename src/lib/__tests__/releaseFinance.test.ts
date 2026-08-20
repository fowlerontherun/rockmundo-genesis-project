import { describe, expect, it } from 'vitest';
import { bandReleaseProfitMajor } from '../releaseMoney';

describe('recorded release finance', () => {
  it('reconciles an independent 100 CD sale', () => {
    const gross = 100 * 1499;
    const tax = Math.round(gross * .10);
    const distribution = Math.round(gross * .20);
    expect(bandReleaseProfitMajor(gross-tax-distribution, 4200)).toBeCloseTo(1007.3, 1);
  });

  it('subtracts only costs actually paid by the band', () => {
    expect(bandReleaseProfitMajor(350000, 10000)).toBe(3400);
    expect(bandReleaseProfitMajor(350000, 10000 + 100000)).not.toBe(3400);
  });

  it('repairs only the 100x overcharge difference', () => {
    expect(4200 - 42).toBe(4158);
  });
});
