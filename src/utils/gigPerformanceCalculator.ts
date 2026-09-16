import { applyBehaviorToPerformance } from "./stageBehaviors";

export interface PerformanceFactors {
  songQuality: number;        // 0-1000 from song quality system
  rehearsalLevel: number;     // 0-100
  bandChemistry: number;      // 0-100
  equipmentQuality: number;   // 0-100 average of all equipment
  crewSkillLevel: number;     // 0-100 average of all crew
  memberSkillAverage: number; // 0-150 from band skill calculator
  venueCapacityUsed: number;  // 0-100 percentage
  productionNotesBonus?: number; // 0-0.30 (0-30% bonus from production notes)
  gearReliabilityBonus?: number; // 0-0.05 (reduces negative variance swings)
  momentum?: number;          // -3 to +3 momentum from previous songs
  songPosition?: number;      // Position in setlist (1-indexed)
  stageSkillAverage?: number; // 0-100 from showmanship, crowd, tech skills
  improvisationLevel?: number; // 0-20 from improv skill level
  genreSkillMultiplier?: number; // 1.0-1.20 bonus from genre skill tree training
  stageBehavior?: string;      // Stage behavior key (e.g. 'aggressive', 'confident')
}

export interface SongPerformanceResult {
  score: number; // 0-25 stars
  breakdown: {
    songQuality: number;
    rehearsal: number;
    chemistry: number;
    equipment: number;
    crew: number;
    memberSkills: number;
    stageSkills: number;
  };
  crowdResponse: 'ecstatic' | 'enthusiastic' | 'engaged' | 'mixed' | 'disappointed';
}

const WEIGHTS = {
  songQuality: 0.25,      // 25% - the song itself
  rehearsal: 0.20,        // 20% - how well they know it
  chemistry: 0.15,        // 15% - band cohesion
  equipment: 0.12,        // 12% - stage gear quality
  crew: 0.08,             // 8% - production team
  memberSkills: 0.10,     // 10% - instrument abilities
  stageSkills: 0.10       // 10% - showmanship, crowd engagement, stage tech
};

export function calculateSongPerformance(factors: PerformanceFactors): SongPerformanceResult {
  // Get stage behavior modifiers
  const behavior = applyBehaviorToPerformance(
    factors.stageBehavior || 'standard',
    factors.momentum || 0
  );

  // Normalize all factors to 0-100 scale
  const normalizedSongQuality = Math.min(100, (factors.songQuality / 1000) * 100);
  const normalizedMemberSkills = Math.min(100, (factors.memberSkillAverage / 150) * 100);
  const normalizedStageSkills = Math.min(100, factors.stageSkillAverage ?? 50);
  
  // Apply chemistry behavior modifier
  const effectiveChemistry = factors.bandChemistry * behavior.chemistryMultiplier;
  
  // Calculate individual contributions
  const songQualityContrib = normalizedSongQuality * WEIGHTS.songQuality;
  const rehearsalContrib = factors.rehearsalLevel * WEIGHTS.rehearsal;
  const chemistryContrib = Math.min(100, effectiveChemistry) * WEIGHTS.chemistry;
  const equipmentContrib = factors.equipmentQuality * WEIGHTS.equipment;
  const crewContrib = factors.crewSkillLevel * WEIGHTS.crew;
  const memberSkillsContrib = normalizedMemberSkills * WEIGHTS.memberSkills;
  const stageSkillsContrib = normalizedStageSkills * WEIGHTS.stageSkills;
  
  // Calculate weighted average (0-100 scale) + behavior base score bonus
  const baseScore = 
    songQualityContrib +
    rehearsalContrib +
    chemistryContrib +
    equipmentContrib +
    crewContrib +
    memberSkillsContrib +
    stageSkillsContrib +
    behavior.baseScoreBonus;
  
  // Venue capacity bonus/penalty
  let capacityMultiplier = 1.0;
  if (factors.venueCapacityUsed >= 95) {
    capacityMultiplier = 1.15; // sold out energy!
  } else if (factors.venueCapacityUsed >= 80) {
    capacityMultiplier = 1.08;
  } else if (factors.venueCapacityUsed >= 60) {
    capacityMultiplier = 1.0;
  } else if (factors.venueCapacityUsed >= 40) {
    capacityMultiplier = 0.95; // sparse crowd hurts
  } else {
    capacityMultiplier = 0.85; // empty venue = bad energy
  }
  
  // VARIANCE — modified by behavior
  const reliabilityBonus = Math.max(0, Math.min(0.05, factors.gearReliabilityBonus ?? 0));
  const varianceFloor = 0.85 + (reliabilityBonus * 2); // 0.85 to 0.95 base
  const varianceRange = Math.max(0.10, 0.30 - reliabilityBonus * 3); // 0.10 to 0.30 range
  const adjustedVarianceRange = varianceRange * behavior.varianceMultiplier;
  const variance = varianceFloor + Math.random() * adjustedVarianceRange;
  
  // Momentum bonus/penalty — modified by behavior
  const momentum = factors.momentum || 0;
  const momentumMultiplier = 1 + (momentum * 0.04 * behavior.momentumMultiplier);
  
  // Setlist position effects — opening penalty modified by behavior
  const position = factors.songPosition || 1;
  let positionMultiplier = 1.0;
  if (position === 1) {
    const openingPenalty = 0.05 * behavior.openingPenaltyMultiplier;
    positionMultiplier = 1.0 - openingPenalty;
  } else if (position >= 8) {
    positionMultiplier = 1.05; // Crowd is warmed up
  }
  
  // Random event chance — modified by behavior + improvisation
  const improvLevel = factors.improvisationLevel ?? 0;
  const improvShift = improvLevel * 0.002;
  let eventMultiplier = 1.0;
  const eventRoll = Math.random();
  const positiveThreshold = 0.08 + improvShift + behavior.positiveEventBonus;
  const negativeStart = positiveThreshold;
  const negativeThreshold = negativeStart + Math.max(0, 0.06 - improvShift + behavior.negativeEventBonus);
  const minorPositiveThreshold = negativeThreshold + 0.06 + improvShift;
  
  if (eventRoll < positiveThreshold) {
    eventMultiplier = 1.15 + Math.random() * 0.10;
  } else if (eventRoll < negativeThreshold) {
    eventMultiplier = 0.80 + Math.random() * 0.10;
  } else if (eventRoll < minorPositiveThreshold) {
    eventMultiplier = 1.08 + Math.random() * 0.07;
  }
  
  // Apply production notes bonus
  const productionMultiplier = 1 + (factors.productionNotesBonus || 0);
  
  // Apply genre skill bonus
  const genreMultiplier = factors.genreSkillMultiplier ?? 1.0;
  
  // Convert to 25-star scale with all multipliers
  const qualityDifficulty = 0.75 + (normalizedSongQuality / 100) * 0.25;
  const finalScore = (baseScore / 100) * 25 * capacityMultiplier * variance * productionMultiplier * qualityDifficulty * momentumMultiplier * positionMultiplier * eventMultiplier * genreMultiplier;
  const clampedScore = Math.max(0, Math.min(25, finalScore));
  
  // Determine crowd response — behavior's crowd engagement modifies thresholds
  const crowdMod = behavior.crowdEngagementMultiplier;
  let crowdResponse: SongPerformanceResult['crowdResponse'];
  // Higher crowd engagement = lower thresholds needed for better responses
  if (clampedScore >= 22 / crowdMod) {
    crowdResponse = 'ecstatic';
  } else if (clampedScore >= 18 / crowdMod) {
    crowdResponse = 'enthusiastic';
  } else if (clampedScore >= 14 / crowdMod) {
    crowdResponse = 'engaged';
  } else if (clampedScore >= 10 / crowdMod) {
    crowdResponse = 'mixed';
  } else {
    crowdResponse = 'disappointed';
  }
  
  return {
    score: clampedScore,
    breakdown: {
      songQuality: (songQualityContrib / 100) * 25,
      rehearsal: (rehearsalContrib / 100) * 25,
      chemistry: (chemistryContrib / 100) * 25,
      equipment: (equipmentContrib / 100) * 25,
      crew: (crewContrib / 100) * 25,
      memberSkills: (memberSkillsContrib / 100) * 25,
      stageSkills: (stageSkillsContrib / 100) * 25
    },
    crowdResponse
  };
}

/**
 * Ticketing historically received venue prestige in two shapes: the normal
 * gameplay scale (1-10) and legacy famous venues (70-100). Convert either form
 * to one 1-10 tier before it affects price or demand.
 */
export function normalizeVenuePrestigeForTickets(venuePrestige: number): number {
  const safePrestige = Number.isFinite(venuePrestige) && venuePrestige > 0
    ? venuePrestige
    : 1;
  const normalized = safePrestige > 10
    ? Math.round(safePrestige / 10)
    : Math.round(safePrestige);

  return Math.max(1, Math.min(10, normalized));
}

/**
 * Lower-capacity venues should be affordable stepping stones. Capacity sets the
 * base price and prestige adds a modest premium instead of multiplying it.
 */
export function getRecommendedGigTicketPrice(venueCapacity: number, venuePrestige: number): number {
  const capacity = Math.max(1, Number.isFinite(venueCapacity) ? Math.round(venueCapacity) : 100);
  const prestigeTier = normalizeVenuePrestigeForTickets(venuePrestige);

  let capacityPrice: number;
  if (capacity <= 100) capacityPrice = 5;
  else if (capacity <= 200) capacityPrice = 6;
  else if (capacity <= 500) capacityPrice = 8;
  else if (capacity <= 1000) capacityPrice = 10;
  else if (capacity <= 2500) capacityPrice = 13;
  else if (capacity <= 5000) capacityPrice = 16;
  else if (capacity <= 10000) capacityPrice = 20;
  else if (capacity <= 25000) capacityPrice = 24;
  else if (capacity <= 50000) capacityPrice = 28;
  else capacityPrice = 32;

  const starterDiscount = capacity <= 200 && prestigeTier <= 2
    ? 2
    : capacity <= 500 && prestigeTier <= 3
      ? 1
      : 0;

  return Math.max(5, Math.round(capacityPrice + ((prestigeTier - 1) * 2) - starterDiscount));
}

export function calculateAttendanceForecast(
  bandFame: number,
  bandPopularity: number,
  venueCapacity: number,
  venuePrestige: number,
  ticketPrice: number,
  setlistQuality: number,
  productionNotesAttendanceBonus: number = 0
): {
  pessimistic: number;
  realistic: number;
  optimistic: number;
} {
  // More generous base demand calculation, while still making venue fit matter.
  const fameMultiplier = Math.min(1, Math.max(0.15, (bandFame / 2000) * 0.6 + (bandPopularity / 500) * 0.4));
  const idealCapacity = (bandFame / 30) + (bandPopularity / 8);
  const venueMatchPenalty = venueCapacity > idealCapacity
    ? Math.max(0.5, Math.min(1.0, idealCapacity / venueCapacity))
    : 1.0;

  const prestigeTier = normalizeVenuePrestigeForTickets(venuePrestige);
  const recommendedTicketPrice = getRecommendedGigTicketPrice(venueCapacity, venuePrestige);
  const priceRatio = Math.max(ticketPrice, 1) / recommendedTicketPrice;

  let priceDemandMultiplier: number;
  if (priceRatio <= 0.75) {
    priceDemandMultiplier = 1.30;
  } else if (priceRatio <= 1.00) {
    priceDemandMultiplier = 1.15;
  } else if (priceRatio <= 1.25) {
    priceDemandMultiplier = 1.00;
  } else if (priceRatio <= 1.50) {
    priceDemandMultiplier = 0.82;
  } else if (priceRatio <= 2.00) {
    priceDemandMultiplier = 0.60;
  } else {
    priceDemandMultiplier = 0.40;
  }

  const setlistBonus = 1 + Math.min(0.2, setlistQuality / 1000);
  const productionBonus = 1 + productionNotesAttendanceBonus;

  // Small low-prestige rooms get local walk-up demand so they are viable for
  // starter bands, but an overpriced ticket still cuts that demand sharply.
  let starterWalkupFloor = 0;
  if (venueCapacity <= 100 && prestigeTier <= 2) {
    starterWalkupFloor = venueCapacity * 0.18;
  } else if (venueCapacity <= 200 && prestigeTier <= 3) {
    starterWalkupFloor = venueCapacity * 0.15;
  } else if (venueCapacity <= 500 && prestigeTier <= 3) {
    starterWalkupFloor = venueCapacity * 0.10;
  }

  const organicAttendance = venueCapacity
    * fameMultiplier
    * venueMatchPenalty
    * priceDemandMultiplier
    * setlistBonus
    * productionBonus;
  const walkupAttendance = starterWalkupFloor
    * priceDemandMultiplier
    * setlistBonus
    * productionBonus;
  const minimumAttendance = priceRatio <= 2
    ? venueCapacity * 0.05 * priceDemandMultiplier
    : 0;

  const baseAttendance = Math.min(
    venueCapacity,
    Math.max(minimumAttendance, walkupAttendance, organicAttendance)
  );

  return {
    pessimistic: Math.max(1, Math.round(baseAttendance * 0.7)),
    realistic: Math.max(1, Math.round(baseAttendance)),
    optimistic: Math.max(1, Math.round(Math.min(venueCapacity, baseAttendance * 1.3)))
  };
}

export function calculateMerchSales(
  attendance: number,
  bandFame: number,
  performanceRating: number,
  merchItems: Array<{ selling_price: number; stock_quantity: number; item_type: string }>,
  productionNotesMerchBonus: number = 0
): { totalRevenue: number; itemsSold: number } {
  if (merchItems.length === 0 || merchItems.every(item => item.stock_quantity === 0)) {
    return { totalRevenue: 0, itemsSold: 0 };
  }
  
  // Purchase rate: 5-15% of attendees
  const basePurchaseRate = 0.05 + (Math.min(1, bandFame / 5000) * 0.05);
  const performanceBonus = Math.min(1.5, performanceRating / 18);
  const productionBonus = 1 + productionNotesMerchBonus;
  const actualPurchaseRate = basePurchaseRate * performanceBonus * productionBonus;
  
  const numberOfBuyers = Math.round(attendance * actualPurchaseRate);
  
  let totalRevenue = 0;
  let itemsSold = 0;
  
  for (let i = 0; i < numberOfBuyers; i++) {
    const itemCount = Math.random() < 0.7 ? 1 : 2; // 70% buy 1, 30% buy 2
    
    for (let j = 0; j < itemCount; j++) {
      // Weight towards cheaper items
      const availableItems = merchItems.filter(item => item.stock_quantity > 0);
      if (availableItems.length === 0) break;
      
      const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
      totalRevenue += randomItem.selling_price;
      itemsSold++;
    }
  }
  
  return { totalRevenue, itemsSold };
}

export function getPerformanceGrade(rating: number): { grade: string; label: string; color: string } {
  if (rating >= 23) {
    return { grade: 'S', label: 'Legendary', color: 'text-yellow-500' };
  } else if (rating >= 20) {
    return { grade: 'A', label: 'Exceptional', color: 'text-purple-500' };
  } else if (rating >= 17) {
    return { grade: 'B', label: 'Excellent', color: 'text-blue-500' };
  } else if (rating >= 14) {
    return { grade: 'C', label: 'Great', color: 'text-green-500' };
  } else if (rating >= 11) {
    return { grade: 'D', label: 'Good', color: 'text-yellow-600' };
  } else if (rating >= 8) {
    return { grade: 'E', label: 'Average', color: 'text-orange-500' };
  } else {
    return { grade: 'F', label: 'Poor', color: 'text-red-500' };
  }
}