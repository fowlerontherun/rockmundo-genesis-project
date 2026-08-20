/**
 * Recorded-release money contract:
 *
 * Release costs, prices, and sale rows are persisted as integer minor units
 * (cents). Band and label treasury balances and all UI totals are major units
 * (dollars). Conversion is only performed at those boundaries.
 */
export type MinorUnits = number;
export type MajorUnits = number;

export const minorToMajor = (amountMinor: MinorUnits): MajorUnits => amountMinor / 100;
export const majorToMinor = (amountMajor: MajorUnits): MinorUnits => Math.round(amountMajor * 100);

export const releaseCostMajor = (
  manufacturingCostMinor: MinorUnits,
  territorySetupCostMinor: MinorUnits,
): MajorUnits => minorToMajor(manufacturingCostMinor + territorySetupCostMinor);

export function releaseProfitMajor(bandNetMajor: MajorUnits, totalReleaseCostMinor: MinorUnits): MajorUnits {
  return bandNetMajor - minorToMajor(totalReleaseCostMinor);
}
