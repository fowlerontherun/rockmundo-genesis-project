import { describe, expect, it } from 'vitest';
import { editionCurrency, formatBookingMoney } from '../formatting';

describe('booking currency helpers', () => {
  it('uses edition currency before supported fallback', () => {
    expect(editionCurrency({ currency_code: 'EUR', supported_currency_codes: ['GBP'] })).toBe('EUR');
    expect(editionCurrency({ supported_currency_codes: ['GBP'] })).toBe('GBP');
  });

  it('does not silently format unknown currency as USD', () => {
    expect(formatBookingMoney(1200, 'XXX')).toContain('credits');
  });
});
