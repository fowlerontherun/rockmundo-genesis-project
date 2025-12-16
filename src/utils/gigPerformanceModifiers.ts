// Enhanced Gig Performance Modifiers
// Calculates various factors that affect gig outcomes

export interface PerformanceModifiers {
  baseModifier: number;
  chemistryBonus: number;
  rehearsalBonus: number;
  equipmentBonus: number;
  venueRelationshipBonus: number;
  crowdMoodBonus: number;
  weatherModifier: number;
  timeSlotModifier: number;
  specialEventBonus: number;
  totalModifier: number;
  breakdown: ModifierBreakdown[];
}

export interface ModifierBreakdown {
  name: string;
  value: number;
  description: string;
  icon: string;
}

export interface GigContext {
  bandChemistry: number; // 0-100
  averageRehearsalLevel: number; // 0-100
  equipmentQuality: number; // 0-100
  venueRelationshipTier: string;
  isOutdoor: boolean;
  weather?: 'perfect' | 'good' | 'rain' | 'storm' | 'hot' | 'cold';
  timeSlot: 'afternoon' | 'evening' | 'late_night' | 'early';
  isSpecialEvent: boolean;
  specialEventType?: string;
  crowdExpectations: 'low' | 'medium' | 'high';
  bandFame: number;
  venueFame: number;
}

const CHEMISTRY_MODIFIERS = {
  0: -0.20,   // Dysfunctional
  25: -0.10,  // Struggling
  50: 0,      // Average
  75: 0.10,   // Good
  90: 0.20,   // Excellent
  100: 0.25,  // Perfect synergy
};

const REHEARSAL_MODIFIERS = {
  0: -0.20,   // Unprepared
  25: -0.10,  // Underprepared
  50: 0,      // Adequate
  75: 0.15,   // Well-rehearsed
  100: 0.25, // Perfected
};

const VENUE_RELATIONSHIP_MODIFIERS: Record<string, number> = {
  'newcomer': 0,
  'regular': 0.05,
  'favorite': 0.10,
  'legendary': 0.20,
};

const WEATHER_MODIFIERS = {
  'perfect': 0.10,
  'good': 0.05,
  'rain': -0.10,
  'storm': -0.25,
  'hot': -0.05,
  'cold': -0.05,
};

const TIME_SLOT_MODIFIERS = {
  'afternoon': -0.05,  // Smaller crowd energy
  'evening': 0.10,     // Prime time
  'late_night': 0.05,  // Dedicated fans
  'early': -0.10,      // Opening slot
};

const SPECIAL_EVENT_BONUSES: Record<string, number> = {
  'album_launch': 0.15,
  'anniversary': 0.10,
  'charity': 0.05,
  'festival': 0.20,
  'tv_broadcast': 0.25,
  'competition': 0.15,
};

export function calculatePerformanceModifiers(context: GigContext): PerformanceModifiers {
  const breakdown: ModifierBreakdown[] = [];
  
  // Chemistry bonus
  let chemistryBonus = 0;
  for (const [threshold, modifier] of Object.entries(CHEMISTRY_MODIFIERS).reverse()) {
    if (context.bandChemistry >= parseInt(threshold)) {
      chemistryBonus = modifier;
      break;
    }
  }
  breakdown.push({
    name: 'Band Chemistry',
    value: chemistryBonus,
    description: getChemistryDescription(context.bandChemistry),
    icon: '🎸',
  });

  // Rehearsal bonus
  let rehearsalBonus = 0;
  for (const [threshold, modifier] of Object.entries(REHEARSAL_MODIFIERS).reverse()) {
    if (context.averageRehearsalLevel >= parseInt(threshold)) {
      rehearsalBonus = modifier;
      break;
    }
  }
  breakdown.push({
    name: 'Rehearsal Level',
    value: rehearsalBonus,
    description: getRehearsalDescription(context.averageRehearsalLevel),
    icon: '🎵',
  });

  // Equipment bonus (0-20%)
  const equipmentBonus = (context.equipmentQuality / 100) * 0.20 - 0.10;
  breakdown.push({
    name: 'Equipment Quality',
    value: equipmentBonus,
    description: `${context.equipmentQuality}% quality gear`,
    icon: '🔊',
  });

  // Venue relationship bonus
  const venueRelationshipBonus = VENUE_RELATIONSHIP_MODIFIERS[context.venueRelationshipTier] || 0;
  if (venueRelationshipBonus !== 0) {
    breakdown.push({
      name: 'Venue Relationship',
      value: venueRelationshipBonus,
      description: `${context.venueRelationshipTier} status`,
      icon: '🏠',
    });
  }

  // Weather modifier (outdoor only)
  let weatherModifier = 0;
  if (context.isOutdoor && context.weather) {
    weatherModifier = WEATHER_MODIFIERS[context.weather] || 0;
    breakdown.push({
      name: 'Weather',
      value: weatherModifier,
      description: `${context.weather} conditions`,
      icon: context.weather === 'perfect' ? '☀️' : context.weather === 'rain' ? '🌧️' : '🌤️',
    });
  }

  // Time slot modifier
  const timeSlotModifier = TIME_SLOT_MODIFIERS[context.timeSlot] || 0;
  breakdown.push({
    name: 'Time Slot',
    value: timeSlotModifier,
    description: getTimeSlotDescription(context.timeSlot),
    icon: '🕐',
  });

  // Special event bonus
  let specialEventBonus = 0;
  if (context.isSpecialEvent && context.specialEventType) {
    specialEventBonus = SPECIAL_EVENT_BONUSES[context.specialEventType] || 0.05;
    breakdown.push({
      name: 'Special Event',
      value: specialEventBonus,
      description: formatSpecialEventType(context.specialEventType),
      icon: '⭐',
    });
  }

  // Crowd mood bonus based on fame match
  const fameDifference = context.bandFame - context.venueFame;
  let crowdMoodBonus = 0;
  if (fameDifference > 500) {
    crowdMoodBonus = 0.15; // Band is bigger than venue - excited crowd
    breakdown.push({
      name: 'Star Power',
      value: crowdMoodBonus,
      description: 'Band exceeds venue prestige',
      icon: '🌟',
    });
  } else if (fameDifference < -500) {
    crowdMoodBonus = -0.10; // Crowd expects more
    breakdown.push({
      name: 'High Expectations',
      value: crowdMoodBonus,
      description: 'Tough crowd to impress',
      icon: '😤',
    });
  }

  // Calculate total
  const totalModifier = 1 + chemistryBonus + rehearsalBonus + equipmentBonus + 
    venueRelationshipBonus + weatherModifier + timeSlotModifier + specialEventBonus + crowdMoodBonus;

  return {
    baseModifier: 1,
    chemistryBonus,
    rehearsalBonus,
    equipmentBonus,
    venueRelationshipBonus,
    crowdMoodBonus,
    weatherModifier,
    timeSlotModifier,
    specialEventBonus,
    totalModifier: Math.max(0.5, Math.min(2.0, totalModifier)), // Clamp between 0.5x and 2x
    breakdown,
  };
}

function getChemistryDescription(level: number): string {
  if (level >= 90) return 'Perfect synergy';
  if (level >= 75) return 'Great chemistry';
  if (level >= 50) return 'Working together';
  if (level >= 25) return 'Some tension';
  return 'Dysfunctional';
}

function getRehearsalDescription(level: number): string {
  if (level >= 90) return 'Flawless execution';
  if (level >= 75) return 'Well prepared';
  if (level >= 50) return 'Know the songs';
  if (level >= 25) return 'Rough around edges';
  return 'Winging it';
}

function getTimeSlotDescription(slot: string): string {
  const descriptions: Record<string, string> = {
    'afternoon': 'Afternoon slot',
    'evening': 'Prime evening slot',
    'late_night': 'Late night show',
    'early': 'Opening act',
  };
  return descriptions[slot] || slot;
}

function formatSpecialEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getRandomWeather(isOutdoor: boolean): 'perfect' | 'good' | 'rain' | 'storm' | 'hot' | 'cold' | undefined {
  if (!isOutdoor) return undefined;
  
  const roll = Math.random();
  if (roll < 0.30) return 'perfect';
  if (roll < 0.60) return 'good';
  if (roll < 0.80) return 'rain';
  if (roll < 0.90) return 'hot';
  if (roll < 0.95) return 'cold';
  return 'storm';
}

export function generatePerformanceSummary(modifiers: PerformanceModifiers): string {
  const positives = modifiers.breakdown.filter(b => b.value > 0);
  const negatives = modifiers.breakdown.filter(b => b.value < 0);
  
  let summary = '';
  
  if (positives.length > 0) {
    const topPositive = positives.sort((a, b) => b.value - a.value)[0];
    summary += `${topPositive.icon} ${topPositive.description} boosted the performance. `;
  }
  
  if (negatives.length > 0) {
    const topNegative = negatives.sort((a, b) => a.value - b.value)[0];
    summary += `${topNegative.icon} ${topNegative.description} held things back. `;
  }
  
  if (modifiers.totalModifier >= 1.5) {
    summary += 'An outstanding night overall!';
  } else if (modifiers.totalModifier >= 1.2) {
    summary += 'A great performance!';
  } else if (modifiers.totalModifier >= 1.0) {
    summary += 'A solid show.';
  } else if (modifiers.totalModifier >= 0.8) {
    summary += 'Some room for improvement.';
  } else {
    summary += 'A challenging night.';
  }
  
  return summary;
}
