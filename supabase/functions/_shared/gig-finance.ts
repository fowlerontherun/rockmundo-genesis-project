/** Money in the gig outcome is expressed in whole in-game dollars. */
export interface GigFinanceInput {
  adjustedTicketRevenue: number;
  merchandiseRevenue: number;
  barEntitlement: number;
  attendance: number;
  capacity: number;
  venueBandRevenueShare?: number | null;
  venueCutPercent?: number | null;
  contractedCrewCost: number;
  existingEquipmentCost: number;
  merchandiseCost: number;
}

export interface GigFinanceResult {
  grossRevenue: number;
  venueShare: number;
  eventSecurity: number;
  eventStaffing: number;
  insurance: number;
  stageInfrastructure: number;
  crewCost: number;
  equipmentCost: number;
  totalCosts: number;
  netProfit: number;
  effectiveBandShare: number;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const dollars = (n: number) => Math.round(Math.max(0, n));

/**
 * Arena/stadium shows employ security, event staff, insurance and an additional
 * stage infrastructure crew even when the band chooses a minimal production plan.
 * Small clubs keep their existing booked crew/preparation costs. Booking fees
 * were already debited at reservation time and must NOT be charged again here.
 */
export function calculateGigFinance(input: GigFinanceInput): GigFinanceResult {
  const capacity = dollars(input.capacity);
  const attendance = clamp(dollars(input.attendance), 0, capacity);
  const ticketRevenue = dollars(input.adjustedTicketRevenue);
  const grossRevenue = dollars(ticketRevenue + dollars(input.merchandiseRevenue) + dollars(input.barEntitlement));

  const largeShowFactor = clamp((capacity - 2500) / 17500, 0, 1);
  const rawBandShare = Number(input.venueBandRevenueShare ?? 1);
  const configuredBandShare = input.venueBandRevenueShare != null
    ? clamp(rawBandShare > 1 ? rawBandShare / 100 : rawBandShare, 0.45, 1)
    : 1 - clamp(Number(input.venueCutPercent ?? 25), 0, 45) / 100;
  // The existing booking fee covers venue hire for smaller shows. At arenas
  // and stadiums, the venue's configured ticketing share also applies.
  const effectiveBandShare = 1 - (1 - configuredBandShare) * largeShowFactor;
  const venueShare = dollars(ticketRevenue * (1 - effectiveBandShare));

  const eventSecurity = dollars(attendance * 5.5 * largeShowFactor);
  const eventStaffing = dollars(attendance * 3.5 * largeShowFactor);
  const insurance = dollars(ticketRevenue * 0.018 * largeShowFactor);
  const stageInfrastructure = dollars(120_000 * largeShowFactor);
  const crewCost = dollars(input.contractedCrewCost) + eventSecurity + eventStaffing;
  const equipmentCost = dollars(input.existingEquipmentCost) + stageInfrastructure;
  const totalCosts = venueShare + crewCost + equipmentCost + insurance + dollars(input.merchandiseCost);

  return {
    grossRevenue, venueShare, eventSecurity, eventStaffing, insurance,
    stageInfrastructure, crewCost, equipmentCost, totalCosts,
    netProfit: Math.round(grossRevenue - totalCosts), effectiveBandShare,
  };
}
