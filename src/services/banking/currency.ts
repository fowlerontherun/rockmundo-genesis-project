const FALLBACK_MINOR_UNITS: Record<string, number> = {
  USD: 2,
  GBP: 2,
  EUR: 2,
  JPY: 0,
};

export function getCurrencyMinorUnit(currencyCode: string): number {
  return FALLBACK_MINOR_UNITS[currencyCode.toUpperCase()] ?? 2;
}

export function formatCurrencyMinor(input: { amountMinor: number; currencyCode: string; locale?: string; minorUnitPrecision?: number }): string;
export function formatCurrencyMinor(amountMinor: number, currencyCode: string, locale?: string, minorUnitPrecision?: number): string;
export function formatCurrencyMinor(
  inputOrAmount: number | { amountMinor: number; currencyCode: string; locale?: string; minorUnitPrecision?: number },
  currencyCode?: string,
  locale?: string,
  minorUnitPrecision?: number,
): string {
  const input = typeof inputOrAmount === "number"
    ? { amountMinor: inputOrAmount, currencyCode: currencyCode ?? "USD", locale, minorUnitPrecision }
    : inputOrAmount;
  const cc = input.currencyCode.toUpperCase();
  const precision = input.minorUnitPrecision ?? getCurrencyMinorUnit(cc);
  const amount = input.amountMinor / 10 ** precision;
  return new Intl.NumberFormat(input.locale, {
    style: "currency",
    currency: cc,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(amount);
}
