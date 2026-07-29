export const fromMinorUnits = (amountMinor: number): number => amountMinor / 100;

export const createCurrencyFormatter = (
  currencyCode = "GBP",
  maximumFractionDigits = 0,
) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencyCode || "GBP",
    maximumFractionDigits,
  });

export const formatMoney = (
  amount: number,
  currencyCode = "GBP",
  maximumFractionDigits = 0,
): string => createCurrencyFormatter(currencyCode, maximumFractionDigits).format(amount);

export const formatMinorMoney = (
  amountMinor: number,
  currencyCode = "GBP",
  maximumFractionDigits = 0,
): string => formatMoney(fromMinorUnits(amountMinor), currencyCode, maximumFractionDigits);
