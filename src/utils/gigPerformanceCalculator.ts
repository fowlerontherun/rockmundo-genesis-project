export interface PerformanceFactors {
  songQuality: number;        // 0-1000 from song quality system
  rehearsalLevel: number;     // 0-100
  bandChemistry: number;      // 0-100
  equipmentQuality: number;   // 0-100 average of all equipment
  crewSkillLevel: number;     // 0-100 average of all crew
  memberSkillAverage: number; // 0-150 from band skill calculator
  venueCapacityUsed: number;  // 0-100 percentage
  productionNotesBonus?: number; // 0-0.30 (0-30% bonus from production notes)
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
  };
  crowdResponse: 'ecstatic' | 'enthusiastic' | 'engaged' | 'mixed' | 'disappointed';
}

const WEIGHTS = {
  songQuality: 0.25,      // 25% - the song itself
  rehearsal: 0.20,        // 20% - how well they know it
  chemistry: 0.15,        // 15% - band cohesion
  equipment: 0.15,        // 15% - stage gear quality
  crew: 0.10,             // 10% - production team
  memberSkills: 0.15      // 15% - player abilities
};

export function calculateSongPerformance(factors: PerformanceFactors): SongPerformanceResult {
  // Normalize all factors to 0-100 scale
  const normalizedSongQuality = Math.min(100, (factors.songQuality / 1000) * 100);
  const normalizedMemberSkills = Math.min(100, (factors.memberSkillAverage / 150) * 100);
  
  // Calculate individual contributions
  const songQualityContrib = normalizedSongQuality * WEIGHTS.songQuality;
  const rehearsalContrib = factors.rehearsalLevel * WEIGHTS.rehearsal;
  const chemistryContrib = factors.bandChemistry * WEIGHTS.chemistry;
  const equipmentContrib = factors.equipmentQuality * WEIGHTS.equipment;
  const crewContrib = factors.crewSkillLevel * WEIGHTS.crew;
  const memberSkillsContrib = normalizedMemberSkills * WEIGHTS.memberSkills;
  
  // Calculate weighted average (0-100 scale)
  const baseScore = 
    songQualityContrib +
    rehearsalContrib +
    chemistryContrib +
    equipmentContrib +
    crewContrib +
    memberSkillsContrib;
  
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
  
  // Add random variance (±5%) for realism
  const variance = 0.95 + (Math.random() * 0.1);
  
  // Apply production notes bonus
  const productionMultiplier = 1 + (factors.productionNotesBonus || 0);
  
  // Convert to 25-star scale
  const finalScore = (baseScore / 100) * 25 * capacityMultiplier * variance * productionMultiplier;
  const clampedScore = Math.max(0, Math.min(25, finalScore));
  
  // Determine crowd response based on score
  let crowdResponse: SongPerformanceResult['crowdResponse'];
  if (clampedScore >= 22) {
    crowdResponse = 'ecstatic';
  } else if (clampedScore >= 18) {
    crowdResponse = 'enthusiastic';
  } else if (clampedScore >= 14) {
    crowdResponse = 'engaged';
  } else if (clampedScore >= 10) {
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
      memberSkills: (memberSkillsContrib / 100) * 25
    },
    crowdResponse
  };
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
  // Base demand from band fame (0-100% of capacity)
  const fameMultiplier = Math.min(1, (bandFame / 10000) * 0.5 + (bandPopularity / 1000) * 0.5);
  
  // Venue match: bands need certain fame for certain venue sizes
  const idealCapacity = (bandFame / 50) + (bandPopularity / 10);
  const venueMatchPenalty = venueCapacity > idealCapacity ? 
    Math.max(0.3, idealCapacity / venueCapacity) : 1.0;
  
  // Price sensitivity: demand curve
  const avgTicketPrice = 20 + (venuePrestige * 5); // baseline $20-$70
  const priceRatio = ticketPrice / avgTicketPrice;
  let priceDemandMultiplier;
  
  if (priceRatio < 0.5) {
    priceDemandMultiplier = 1.2; // cheap = higher demand
  } else if (priceRatio < 0.8) {
    priceDemandMultiplier = 1.1;
  } else if (priceRatio < 1.2) {
    priceDemandMultiplier = 1.0; // fair price
  } else if (priceRatio < 1.5) {
    priceDemandMultiplier = 0.8; // expensive = lower demand
  } else {
    priceDemandMultiplier = 0.5; // very expensive
  }
  
  // Setlist quality bonus (1.0 to 1.2x)
  const setlistBonus = 1 + Math.min(0.2, setlistQuality / 1000);
  
  // Production notes attendance bonus (1.0 to 1.3x)
  const productionBonus = 1 + productionNotesAttendanceBonus;
  
  // Base expected attendance - ensure minimum 5% if price isn't too high
  const baseAttendance = Math.max(
    priceRatio < 2 ? venueCapacity * 0.05 : 0,
    venueCapacity * fameMultiplier * venueMatchPenalty * priceDemandMultiplier * setlistBonus * productionBonus
  );
  
  // Add variance for estimates
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
