/**
 * Ticket Sales Simulation Utility
 * Calculates daily ticket sales based on band fame, fans, venue size, and advance booking days
 */

interface TicketSalesParams {
  bandFame: number;
  bandTotalFans: number;
  venueCapacity: number;
  daysUntilGig: number;
  daysBooked: number; // How many days in advance the gig was booked
  ticketPrice: number;
}

interface DailySalesResult {
  dailySaleRate: number; // Percentage of remaining tickets to sell per day
  expectedTotalSales: number;
  selloutProbability: number;
  salesMomentum: 'slow' | 'steady' | 'fast' | 'sellout';
}

/**
 * Calculate the band's draw power relative to venue size
 * A small band at a large venue = low draw power
 * A large band at a small venue = high draw power (potential sellout)
 */
export function calculateDrawPower(bandFame: number, bandTotalFans: number, venueCapacity: number): number {
  // Base draw from fame (0-100 scale normalized)
  const fameDrawBase = Math.min(1, bandFame / 5000);
  
  // Fan-based draw (fans in area could attend)
  const fanDrawBase = Math.min(1, bandTotalFans / (venueCapacity * 3));
  
  // Combined draw power (0-1 scale)
  const combinedDraw = (fameDrawBase * 0.6) + (fanDrawBase * 0.4);
  
  // Adjust for venue size - harder to fill bigger venues
  const venueSizeModifier = Math.max(0.3, 1 - (venueCapacity / 10000) * 0.5);
  
  return Math.min(1.2, combinedDraw * venueSizeModifier); // Cap at 1.2 for very popular acts
}

/**
 * Calculate daily sales rate based on band draw and booking advance
 */
export function calculateDailySalesRate(params: TicketSalesParams): DailySalesResult {
  const { bandFame, bandTotalFans, venueCapacity, daysUntilGig, daysBooked, ticketPrice } = params;
  
  const drawPower = calculateDrawPower(bandFame, bandTotalFans, venueCapacity);
  
  // Advance booking bonus: booking 14+ days ahead = up to 30% more total sales
  const advanceBookingBonus = Math.min(0.3, (daysBooked / 14) * 0.3);
  
  // Price sensitivity: higher prices = slower sales
  const priceSensitivity = Math.max(0.5, 1 - (ticketPrice / 100) * 0.3);
  
  // Base daily sale rate (% of venue capacity)
  let baseDailyRate: number;
  
  if (drawPower >= 1.0) {
    // High draw - could sell out quickly
    baseDailyRate = 0.25 + (drawPower - 1) * 0.5; // 25-35% per day
  } else if (drawPower >= 0.7) {
    // Good draw - steady sales
    baseDailyRate = 0.12 + (drawPower - 0.7) * 0.4; // 12-24% per day
  } else if (drawPower >= 0.4) {
    // Moderate draw
    baseDailyRate = 0.05 + (drawPower - 0.4) * 0.2; // 5-11% per day
  } else {
    // Low draw - slow sales
    baseDailyRate = 0.02 + drawPower * 0.08; // 2-5% per day
  }
  
  // Apply modifiers
  const dailySaleRate = baseDailyRate * priceSensitivity * (1 + advanceBookingBonus);
  
  // Calculate expected total sales over booking period
  const totalDaysForSales = daysBooked;
  const expectedTotalSales = Math.min(
    venueCapacity,
    Math.round(venueCapacity * dailySaleRate * totalDaysForSales * (1 + advanceBookingBonus))
  );
  
  // Sellout probability
  const selloutProbability = Math.min(100, Math.round(drawPower * 100 * (1 + advanceBookingBonus)));
  
  // Determine sales momentum category
  let salesMomentum: 'slow' | 'steady' | 'fast' | 'sellout';
  if (dailySaleRate >= 0.25) {
    salesMomentum = 'sellout';
  } else if (dailySaleRate >= 0.12) {
    salesMomentum = 'fast';
  } else if (dailySaleRate >= 0.05) {
    salesMomentum = 'steady';
  } else {
    salesMomentum = 'slow';
  }
  
  return {
    dailySaleRate,
    expectedTotalSales,
    selloutProbability,
    salesMomentum
  };
}

/**
 * Simulate ticket sales for a single day
 * Returns the number of tickets sold that day
 */
export function simulateDayTicketSales(
  currentTicketsSold: number,
  venueCapacity: number,
  dailySalesResult: DailySalesResult,
  daysUntilGig: number
): number {
  const remainingTickets = venueCapacity - currentTicketsSold;
  
  if (remainingTickets <= 0) return 0;
  
  // Base tickets to sell today
  let ticketsToday = Math.round(venueCapacity * dailySalesResult.dailySaleRate);
  
  // Urgency bonus: sales increase as gig approaches
  const urgencyMultiplier = daysUntilGig <= 3 ? 1.5 : daysUntilGig <= 7 ? 1.2 : 1.0;
  ticketsToday = Math.round(ticketsToday * urgencyMultiplier);
  
  // Add some randomness (±20%)
  const randomFactor = 0.8 + Math.random() * 0.4;
  ticketsToday = Math.round(ticketsToday * randomFactor);
  
  // Don't oversell
  return Math.min(ticketsToday, remainingTickets);
}

/**
 * Calculate predicted total ticket sales for a gig
 */
export function predictTotalTicketSales(params: TicketSalesParams): number {
  const salesResult = calculateDailySalesRate(params);
  return salesResult.expectedTotalSales;
}

/**
 * Get ticket sales status display info
 */
export function getTicketSalesStatus(ticketsSold: number, predictedTickets: number, venueCapacity: number): {
  label: string;
  color: string;
  percentSold: number;
  percentOfPredicted: number;
} {
  const percentSold = Math.round((ticketsSold / venueCapacity) * 100);
  const percentOfPredicted = predictedTickets > 0 ? Math.round((ticketsSold / predictedTickets) * 100) : 0;
  
  let label: string;
  let color: string;
  
  if (ticketsSold >= venueCapacity) {
    label = 'SOLD OUT';
    color = 'text-green-500';
  } else if (percentOfPredicted >= 100) {
    label = 'Exceeding expectations';
    color = 'text-green-500';
  } else if (percentOfPredicted >= 75) {
    label = 'On track';
    color = 'text-primary';
  } else if (percentOfPredicted >= 50) {
    label = 'Building momentum';
    color = 'text-amber-500';
  } else {
    label = 'Slow sales';
    color = 'text-muted-foreground';
  }
  
  return { label, color, percentSold, percentOfPredicted };
}
