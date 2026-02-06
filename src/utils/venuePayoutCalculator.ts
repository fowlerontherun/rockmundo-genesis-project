/**
 * Venue Payout Calculator
 * 
 * Determines what a venue will pay a band based on:
 * - Band fame & total fans (draw power)
 * - Venue capacity & prestige
 * - Time slot
 * - Rider costs (deducted from venue budget or split)
 */

export interface VenuePayoutBreakdown {
  basePay: number;
  fameBonus: number;
  fanDrawBonus: number;
  prestigeMultiplier: number;
  slotMultiplier: number;
  riderCost: number;
  grossPayout: number;
  netPayout: number; // after rider costs
}

export interface VenuePayoutInput {
  bandFame: number;
  bandTotalFans: number;
  venueCapacity: number;
  venuePrestige: number;
  venueBasePayment: number;
  slotPaymentMultiplier: number;
  riderCost?: number;
}

/**
 * Calculate what a venue will pay for a gig.
 * 
 * Formula:
 * - Base Pay = venue.base_payment × slot multiplier
 * - Fame Bonus = scales with band fame relative to venue expectations
 * - Fan Draw Bonus = how many fans the band can realistically bring
 * - Prestige Multiplier = higher-tier venues pay proportionally more to worthy bands
 * - Rider Cost = deducted from gross payout (venue covers rider)
 */
export function calculateVenuePayout(input: VenuePayoutInput): VenuePayoutBreakdown {
  const {
    bandFame,
    bandTotalFans,
    venueCapacity,
    venuePrestige,
    venueBasePayment,
    slotPaymentMultiplier,
    riderCost = 0,
  } = input;

  // 1. Base payment from venue × slot multiplier
  const basePay = Math.round(venueBasePayment * slotPaymentMultiplier);

  // 2. Fame bonus: how famous is the band relative to venue's expectations?
  //    A 500-cap venue expects ~1000 fame, a 5000-cap expects ~10000 fame
  const expectedFame = Math.max(100, venueCapacity * 2);
  const fameRatio = Math.min(3.0, bandFame / expectedFame);
  // Fame bonus is up to 150% of base pay for a band 3× the expected fame
  const fameBonus = Math.round(basePay * fameRatio * 0.5);

  // 3. Fan draw bonus: what percentage of the venue can the band fill from fans alone?
  //    Assume ~3-5% of a band's total fans might attend a given show
  const estimatedDraw = Math.min(venueCapacity, Math.round(bandTotalFans * 0.04));
  const drawRatio = estimatedDraw / Math.max(1, venueCapacity);
  // Draw bonus is up to 75% of base pay for filling the venue from fans alone
  const fanDrawBonus = Math.round(basePay * drawRatio * 0.75);

  // 4. Prestige multiplier: higher prestige venues pay more generously
  //    Prestige 1 = 1.0×, Prestige 5 = 1.6×, Prestige 10 = 2.35×
  const prestigeMultiplier = 1.0 + (venuePrestige - 1) * 0.15;

  // 5. Calculate gross payout
  const grossPayout = Math.round((basePay + fameBonus + fanDrawBonus) * prestigeMultiplier);

  // 6. Venue covers rider cost — deducted from payout
  //    The venue won't pay less than the base amount though
  const effectiveRiderCost = Math.min(riderCost, Math.max(0, grossPayout - basePay));
  const netPayout = Math.max(basePay, grossPayout - effectiveRiderCost);

  return {
    basePay,
    fameBonus,
    fanDrawBonus,
    prestigeMultiplier,
    slotMultiplier: slotPaymentMultiplier,
    riderCost: effectiveRiderCost,
    grossPayout,
    netPayout,
  };
}

/**
 * Get a human-readable tier label for a payout amount
 */
export function getPayoutTier(amount: number): { label: string; color: string } {
  if (amount >= 50000) return { label: 'Arena-Level', color: 'text-yellow-500' };
  if (amount >= 20000) return { label: 'Major', color: 'text-purple-500' };
  if (amount >= 10000) return { label: 'Premium', color: 'text-blue-500' };
  if (amount >= 5000) return { label: 'Professional', color: 'text-green-500' };
  if (amount >= 2000) return { label: 'Standard', color: 'text-cyan-500' };
  if (amount >= 500) return { label: 'Entry', color: 'text-muted-foreground' };
  return { label: 'Open Mic', color: 'text-muted-foreground' };
}
