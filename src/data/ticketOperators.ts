// Ticket operator definitions for gig and tour bookings
export interface TicketOperator {
  id: string;
  name: string;
  description: string;
  cut: number; // Percentage of ticket sales taken by operator
  salesBoost: number; // Multiplier for ticket sales
  toutLevel: number; // 0-1, higher = more tickets go to touts
  minVenueCapacity: number; // Minimum venue size required
  dynamicPricing: boolean; // Can raise prices but risks fan backlash
}

export const TICKET_OPERATORS: TicketOperator[] = [
  {
    id: 'feemaster',
    name: 'FeeMaster',
    description: 'Basic ticketing with minimal fees. Honest and straightforward.',
    cut: 0.08,
    salesBoost: 1.0,
    toutLevel: 0,
    minVenueCapacity: 200,
    dynamicPricing: false,
  },
  {
    id: 'tickethoarder',
    name: 'TicketHoarder',
    description: 'Aggressive marketing drives sales, but attracts scalpers.',
    cut: 0.12,
    salesBoost: 1.1,
    toutLevel: 0.15,
    minVenueCapacity: 200,
    dynamicPricing: false,
  },
  {
    id: 'seatsnatcher',
    name: 'SeatSnatcher',
    description: 'High visibility platform. Notorious for touts getting first access.',
    cut: 0.15,
    salesBoost: 1.2,
    toutLevel: 0.25,
    minVenueCapacity: 500,
    dynamicPricing: false,
  },
  {
    id: 'queuemaster',
    name: 'QueueMaster',
    description: 'Premium exposure and marketing. Significant tout presence expected.',
    cut: 0.18,
    salesBoost: 1.35,
    toutLevel: 0.35,
    minVenueCapacity: 1000,
    dynamicPricing: false,
  },
  {
    id: 'clickfastloseanyway',
    name: 'ClickFastLoseAnyway',
    description: 'Maximum reach with dynamic pricing. Heavy touting. May damage reputation.',
    cut: 0.22,
    salesBoost: 1.5,
    toutLevel: 0.45,
    minVenueCapacity: 2000,
    dynamicPricing: true,
  },
];

export function getOperatorById(id: string): TicketOperator | undefined {
  return TICKET_OPERATORS.find(op => op.id === id);
}

export function getAvailableOperators(venueCapacity: number): TicketOperator[] {
  return TICKET_OPERATORS.filter(op => venueCapacity >= op.minVenueCapacity);
}

// Calculate actual attendance after touts (some tickets go to scalpers who don't show)
export function calculateToutImpact(
  ticketsSold: number,
  toutLevel: number
): { realAttendance: number; toutedTickets: number } {
  const toutedTickets = Math.floor(ticketsSold * toutLevel * 0.6); // 60% of touted tickets = no-shows
  return {
    realAttendance: ticketsSold - toutedTickets,
    toutedTickets,
  };
}

// Calculate fan gain reduction due to touting (fans blame the band for tout issues)
export function calculateFanGainPenalty(baseFanGain: number, toutLevel: number): number {
  const penalty = toutLevel * 0.4; // Up to 40% reduction at max tout level
  return Math.floor(baseFanGain * (1 - penalty));
}

// Dynamic pricing can boost revenue but costs fame
export function calculateDynamicPricingImpact(
  baseRevenue: number,
  ticketsSold: number
): { boostedRevenue: number; fameCost: number } {
  // Dynamic pricing increases revenue by 20-50%
  const revenueBoost = 1.2 + Math.random() * 0.3;
  const boostedRevenue = Math.floor(baseRevenue * revenueBoost);
  
  // Fame cost is 5% of fans at the show (they feel exploited)
  const fameCost = Math.floor(ticketsSold * 0.05);
  
  return { boostedRevenue, fameCost };
}
