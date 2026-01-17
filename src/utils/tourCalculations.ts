// Tour cost and revenue calculation utilities

import { 
  TourWizardState, 
  TourCostEstimate, 
  VenueMatch,
  VENUE_SIZE_REQUIREMENTS,
  TOUR_SCOPE_REQUIREMENTS,
  CANCELLATION_REFUND_SCALE,
  TOUR_BUS_DAILY_COST,
  MEMBER_TRAVEL_COST_PER_LEG
} from '@/lib/tourTypes';

// Calculate ticket price based on venue capacity and band fame
export function calculateTicketPrice(capacity: number, bandFame: number): number {
  const basePrice = 15;
  const capacityMultiplier = Math.min(capacity / 1000, 5); // Up to 5x for large venues
  const fameMultiplier = 1 + (bandFame / 100000); // Fame adds up to ~100% more
  
  return Math.round(basePrice * (1 + capacityMultiplier * 0.2) * Math.min(fameMultiplier, 2));
}

// Estimate ticket sales percentage based on band fans and venue capacity
export function estimateTicketSalesPercent(
  capacity: number, 
  bandTotalFans: number,
  bandFame: number
): number {
  const fanToCapacityRatio = Math.min(bandTotalFans / capacity, 3);
  const fameBonus = Math.min(bandFame / 50000, 0.3);
  const basePercent = 0.3 + (fanToCapacityRatio * 0.2) + fameBonus;
  
  return Math.min(Math.max(basePercent, 0.1), 0.95);
}

// Calculate booking fee (10% of estimated revenue, minimum $50)
export function calculateBookingFee(estimatedRevenue: number): number {
  return Math.max(Math.round(estimatedRevenue * 0.1), 50);
}

// Calculate band's share of ticket revenue (default 50%)
export function calculateBandRevenue(grossRevenue: number, revenueShare: number = 0.5): number {
  return Math.round(grossRevenue * revenueShare);
}

// Calculate travel cost between two cities using hybrid approach
export function calculateTravelCost(
  distanceKm: number, 
  travelMode: 'bus' | 'train' | 'plane' | 'tour_bus'
): { cost: number; durationHours: number } {
  const modes = {
    bus: { costPerKm: 0.08, speedKmh: 60, baseCost: 50 },
    train: { costPerKm: 0.12, speedKmh: 180, baseCost: 25 },
    plane: { costPerKm: 0.15, speedKmh: 800, baseCost: 150 },
    tour_bus: { costPerKm: 0.05, speedKmh: 70, baseCost: 0 }, // Daily cost handled separately
  };
  
  const mode = modes[travelMode];
  const cost = mode.baseCost + (distanceKm * mode.costPerKm);
  const durationHours = distanceKm / mode.speedKmh;
  
  return { cost: Math.round(cost), durationHours: Math.round(durationHours * 10) / 10 };
}

// Determine best travel mode based on distance
export function getBestTravelMode(distanceKm: number, useTourBus: boolean): 'bus' | 'train' | 'plane' | 'tour_bus' {
  if (useTourBus) return 'tour_bus';
  if (distanceKm < 300) return 'bus';
  if (distanceKm < 1000) return 'train';
  return 'plane';
}

// Calculate tour bus total cost for duration
export function calculateTourBusCost(durationDays: number, dailyCost: number = TOUR_BUS_DAILY_COST): number {
  return durationDays * dailyCost;
}

// Get maximum venue capacity based on band's total fans
export function getMaxVenueCapacityForFans(totalFans: number): number {
  if (totalFans >= 250000) return 999999; // Stadiums
  if (totalFans >= 50000) return 50000; // Arenas
  if (totalFans >= 10000) return 10000; // Large venues
  if (totalFans >= 1000) return 2000; // Medium venues
  return 500; // Small venues only
}

// Get venue size tier label
export function getVenueSizeTier(capacity: number): string {
  if (capacity <= 500) return 'small';
  if (capacity <= 2000) return 'medium';
  if (capacity <= 10000) return 'large';
  if (capacity <= 50000) return 'arena';
  return 'stadium';
}

// Check if band can access a scope level
export function canAccessScope(bandFame: number, scope: keyof typeof TOUR_SCOPE_REQUIREMENTS): boolean {
  return bandFame >= TOUR_SCOPE_REQUIREMENTS[scope].fame;
}

// Calculate cancellation refund amount
export function calculateCancellationRefund(
  totalUpfrontCost: number,
  tourStartDate: Date,
  cancellationDate: Date = new Date()
): number {
  const daysUntilStart = Math.floor(
    (tourStartDate.getTime() - cancellationDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const refundTier = CANCELLATION_REFUND_SCALE.find(tier => daysUntilStart >= tier.daysBeforeStart);
  const refundPercent = refundTier?.refundPercent ?? 0;
  
  return Math.round(totalUpfrontCost * (refundPercent / 100));
}

// Estimate merchandise sales per attendee based on band fame
export function estimateMerchSalesPerAttendee(bandFame: number): number {
  // Base $5 per attendee, scales with fame (up to $20 per attendee at high fame)
  const baseAmount = 5;
  const fameMultiplier = 1 + Math.min(bandFame / 50000, 3);
  return Math.round(baseAmount * fameMultiplier);
}

// Calculate member travel costs for a tour leg
export function calculateMemberTravelCosts(
  travelMode: 'bus' | 'train' | 'plane' | 'tour_bus',
  memberCount: number,
  legCount: number
): number {
  const costPerLeg = MEMBER_TRAVEL_COST_PER_LEG[travelMode] || 0;
  return costPerLeg * memberCount * legCount;
}

// Calculate full tour cost estimate
export function calculateTourCostEstimate(
  venues: VenueMatch[],
  state: TourWizardState,
  bandFame: number,
  bandTotalFans: number,
  travelingMemberCount: number = 1
): TourCostEstimate {
  let venueCosts = 0;
  let bookingFees = 0;
  let estimatedTicketRevenue = 0;
  let estimatedMerchRevenue = 0;
  let travelCosts = 0;
  
  const merchPerAttendee = estimateMerchSalesPerAttendee(bandFame);
  
  venues.forEach((venue, index) => {
    // Calculate ticket price and estimated sales
    const ticketPrice = calculateTicketPrice(venue.capacity, bandFame);
    const salesPercent = estimateTicketSalesPercent(venue.capacity, bandTotalFans, bandFame);
    const ticketsSold = Math.round(venue.capacity * salesPercent);
    const grossRevenue = ticketsSold * ticketPrice;
    const bandShare = calculateBandRevenue(grossRevenue);
    
    // Booking fee based on estimated revenue
    const bookingFee = calculateBookingFee(bandShare);
    
    // Merch sales (based on attendees, not capacity)
    const merchSales = ticketsSold * merchPerAttendee;
    
    venueCosts += venue.basePayment || 0;
    bookingFees += bookingFee;
    estimatedTicketRevenue += bandShare;
    estimatedMerchRevenue += merchSales;
    
    // Calculate travel cost to next venue (if not last)
    if (index < venues.length - 1) {
      // Simplified: assume average 500km between cities
      const avgDistance = 500;
      const travelMode = getBestTravelMode(avgDistance, state.travelMode === 'tour_bus');
      const { cost } = calculateTravelCost(avgDistance, travelMode);
      travelCosts += cost;
    }
  });
  
  // Tour bus costs (if using tour bus)
  const tourBusCosts = state.travelMode === 'tour_bus' 
    ? calculateTourBusCost(state.durationDays || 30, state.tourBusDailyCost)
    : 0;
  
  // If using tour bus, travel costs are just fuel (already low in tour_bus mode)
  const totalTravelCosts = state.travelMode === 'tour_bus' ? travelCosts : travelCosts;
  
  // Calculate member travel costs (number of legs = venues - 1)
  const legCount = Math.max(0, venues.length - 1);
  const travelMode = getBestTravelMode(500, state.travelMode === 'tour_bus');
  const memberTravelCosts = calculateMemberTravelCosts(travelMode, travelingMemberCount, legCount);
  
  const stageSetupCosts = 0; // Calculated by wizard
  const sponsorCashIncome = 0; // From wizard
  const supportArtistShare = 0; // From wizard
  
  const totalUpfrontCost = venueCosts + bookingFees + totalTravelCosts + tourBusCosts + stageSetupCosts + memberTravelCosts;
  const netUpfrontCost = totalUpfrontCost - sponsorCashIncome;
  const estimatedRevenue = estimatedTicketRevenue + estimatedMerchRevenue - supportArtistShare;
  const estimatedProfit = estimatedRevenue - totalUpfrontCost + sponsorCashIncome;
  
  return {
    venueCosts,
    bookingFees,
    travelCosts: totalTravelCosts,
    tourBusCosts,
    stageSetupCosts,
    memberTravelCosts,
    travelingMemberCount,
    totalUpfrontCost,
    sponsorCashIncome,
    netUpfrontCost,
    estimatedTicketRevenue,
    estimatedMerchRevenue,
    supportArtistShare,
    estimatedRevenue,
    estimatedProfit,
    showCount: venues.length,
  };
}

// Generate tour schedule with rest days
export function generateTourSchedule(
  startDate: Date,
  showCount: number,
  minRestDays: number
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  
  for (let i = 0; i < showCount; i++) {
    dates.push(new Date(currentDate));
    // Add show day + rest days
    currentDate.setDate(currentDate.getDate() + 1 + minRestDays);
  }
  
  return dates;
}

// Calculate tour end date
export function calculateTourEndDate(
  startDate: Date,
  showCount: number,
  minRestDays: number
): Date {
  const daysNeeded = showCount + (showCount - 1) * minRestDays;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysNeeded - 1);
  return endDate;
}
