/**
 * Housing gameplay buffs system.
 * Properties and rentals provide stat bonuses based on tier.
 */

export interface HousingBuffs {
  energyRecoveryBonus: number;   // multiplier on energy recovery, e.g. 1.1 = +10%
  healthRegenBonus: number;      // extra health regen per day
  creativityBonus: number;       // flat bonus to songwriting quality
  comfortLevel: number;          // 0-100, affects wellness
  description: string;
}

const PROPERTY_TIER_BUFFS: Record<number, HousingBuffs> = {
  1: { energyRecoveryBonus: 1.05, healthRegenBonus: 1, creativityBonus: 5, comfortLevel: 20, description: 'Basic shelter — slight energy recovery boost' },
  2: { energyRecoveryBonus: 1.10, healthRegenBonus: 2, creativityBonus: 10, comfortLevel: 35, description: 'Comfortable home — better rest and mild creativity boost' },
  3: { energyRecoveryBonus: 1.15, healthRegenBonus: 3, creativityBonus: 18, comfortLevel: 55, description: 'Nice property — good rest, noticeable creativity boost' },
  4: { energyRecoveryBonus: 1.25, healthRegenBonus: 5, creativityBonus: 30, comfortLevel: 75, description: 'Luxury home — excellent recovery and strong creativity' },
  5: { energyRecoveryBonus: 1.35, healthRegenBonus: 8, creativityBonus: 45, comfortLevel: 95, description: 'Mansion — peak recovery, maximum creativity inspiration' },
};

const RENTAL_TIER_BUFFS: Record<number, HousingBuffs> = {
  1: { energyRecoveryBonus: 1.02, healthRegenBonus: 0, creativityBonus: 2, comfortLevel: 10, description: 'Hostel — minimal comfort' },
  2: { energyRecoveryBonus: 1.05, healthRegenBonus: 1, creativityBonus: 5, comfortLevel: 25, description: 'Apartment — decent rest' },
  3: { energyRecoveryBonus: 1.10, healthRegenBonus: 2, creativityBonus: 12, comfortLevel: 45, description: 'Nice rental — solid comfort and creativity' },
};

const HOMELESS_DEBUFFS: HousingBuffs = {
  energyRecoveryBonus: 0.75,
  healthRegenBonus: -2,
  creativityBonus: -10,
  comfortLevel: 0,
  description: 'No housing — energy drains faster, health suffers, creativity penalized',
};

/**
 * Get housing buffs for a player based on their primary property or rental.
 * @param propertyTier - tier of owned property (null if none)
 * @param rentalTier - tier of active rental (null if none)
 */
export function getHousingBuffs(
  propertyTier: number | null,
  rentalTier: number | null,
): HousingBuffs {
  // Property takes priority over rental
  if (propertyTier && PROPERTY_TIER_BUFFS[propertyTier]) {
    return PROPERTY_TIER_BUFFS[propertyTier];
  }
  if (rentalTier && RENTAL_TIER_BUFFS[rentalTier]) {
    return RENTAL_TIER_BUFFS[rentalTier];
  }
  return HOMELESS_DEBUFFS;
}

/**
 * Check if a player is effectively homeless (no property or rental).
 */
export function isHomeless(propertyTier: number | null, rentalTier: number | null): boolean {
  return !propertyTier && !rentalTier;
}
