export type SaleDeductions = {
  grossMinor: number;
  taxMinor: number;
  distributorMinor: number;
  manufacturerShareMinor: number;
  preLabelNetMinor: number;
  labelShareMinor: number;
  bandNetMinor: number;
};

export function distributionRate(
  overridePercentage: number | null | undefined,
  configuredPercentage: number,
): number {
  const percentage = overridePercentage == null ? configuredPercentage : overridePercentage;
  return Math.max(0, Math.min(50, percentage)) / 100;
}

/** All arithmetic remains in cents until a treasury is credited. */
export function calculateSaleDeductions(args: {
  quantity: number;
  unitPriceMinor: number;
  taxRate: number;
  distributionRate: number;
  physical: boolean;
  manufacturerRevenueSharePercentage?: number | null;
  labelShareRate?: number;
}): SaleDeductions {
  const grossMinor = args.quantity * args.unitPriceMinor;
  const taxMinor = Math.round(grossMinor * args.taxRate);
  const distributorMinor = Math.round(grossMinor * args.distributionRate);
  const manufacturerShareMinor = args.physical
    ? Math.round(grossMinor * Math.max(0, Math.min(50, args.manufacturerRevenueSharePercentage ?? 0)) / 100)
    : 0;
  const preLabelNetMinor = grossMinor - taxMinor - distributorMinor - manufacturerShareMinor;
  const labelShareMinor = Math.round(preLabelNetMinor * Math.max(0, Math.min(1, args.labelShareRate ?? 0)));
  return {
    grossMinor, taxMinor, distributorMinor, manufacturerShareMinor, preLabelNetMinor,
    labelShareMinor, bandNetMinor: preLabelNetMinor - labelShareMinor,
  };
}
