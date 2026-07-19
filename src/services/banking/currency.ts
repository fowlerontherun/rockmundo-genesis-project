const FALLBACK_MINOR_UNITS: Record<string, number> = {
  USD: 2,
  GBP: 2,
  EUR: 2,
  JPY: 0,
};

export function getCurrencyMinorUnit(currencyCode: string): number {
  return FALLBACK_MINOR_UNITS[currencyCode.toUpperCase()] ?? 2;
}

export function formatCurrencyMinor(input: { amountMinor: number; currencyCode: string; locale?: string; minorUnitPrecision?: number }): string {
  const currencyCode = input.currencyCode.toUpperCase();
  const minorUnitPrecision = input.minorUnitPrecision ?? getCurrencyMinorUnit(currencyCode);
  const amount = input.amountMinor / 10 ** minorUnitPrecision;

  return new Intl.NumberFormat(input.locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: minorUnitPrecision,
    maximumFractionDigits: minorUnitPrecision,
  }).format(amount);
}
