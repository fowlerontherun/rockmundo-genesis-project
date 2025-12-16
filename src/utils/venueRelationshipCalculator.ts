import { supabase } from "@/integrations/supabase/client";

export interface VenueRelationshipResult {
  tier: 'newcomer' | 'regular' | 'favorite' | 'legendary';
  loyaltyPoints: number;
  gigsAtVenue: number;
  payoutBonus: number;
  tierBonuses: {
    bookingDiscount: number;
    capacityBonus: number;
    merchBoostPercent: number;
  };
  nextTier: {
    name: string;
    pointsRequired: number;
    pointsToGo: number;
  } | null;
  isNewVenue: boolean;
}

const TIER_THRESHOLDS = {
  regular: 20,
  favorite: 50,
  legendary: 100
};

const TIER_BONUSES = {
  newcomer: { bookingDiscount: 0, capacityBonus: 0, merchBoostPercent: 0 },
  regular: { bookingDiscount: 0.05, capacityBonus: 5, merchBoostPercent: 5 },
  favorite: { bookingDiscount: 0.10, capacityBonus: 10, merchBoostPercent: 10 },
  legendary: { bookingDiscount: 0.15, capacityBonus: 15, merchBoostPercent: 20 }
};

export async function calculateVenueRelationship(
  bandId: string,
  venueId: string,
  gigRating: number
): Promise<VenueRelationshipResult> {
  // Get current relationship
  const { data: existingRelation } = await supabase
    .from('venue_relationships')
    .select('*')
    .eq('band_id', bandId)
    .eq('venue_id', venueId)
    .single();

  const isNewVenue = !existingRelation;
  
  // Calculate loyalty points earned from this gig (5-15 based on rating)
  const pointsEarned = Math.floor(5 + (gigRating / 100) * 10);
  
  const currentPoints = existingRelation?.loyalty_points || 0;
  const newPoints = currentPoints + pointsEarned;
  const gigsAtVenue = (existingRelation?.gigs_performed || 0) + 1;

  // Determine tier
  let tier: VenueRelationshipResult['tier'] = 'newcomer';
  if (newPoints >= TIER_THRESHOLDS.legendary) {
    tier = 'legendary';
  } else if (newPoints >= TIER_THRESHOLDS.favorite) {
    tier = 'favorite';
  } else if (newPoints >= TIER_THRESHOLDS.regular) {
    tier = 'regular';
  }

  // Calculate payout bonus based on tier
  const payoutBonus = tier === 'legendary' ? 0.30 :
                      tier === 'favorite' ? 0.20 :
                      tier === 'regular' ? 0.10 : 0;

  // Determine next tier
  let nextTier: VenueRelationshipResult['nextTier'] = null;
  if (tier === 'newcomer') {
    nextTier = { name: 'Regular', pointsRequired: TIER_THRESHOLDS.regular, pointsToGo: TIER_THRESHOLDS.regular - newPoints };
  } else if (tier === 'regular') {
    nextTier = { name: 'Favorite', pointsRequired: TIER_THRESHOLDS.favorite, pointsToGo: TIER_THRESHOLDS.favorite - newPoints };
  } else if (tier === 'favorite') {
    nextTier = { name: 'Legendary', pointsRequired: TIER_THRESHOLDS.legendary, pointsToGo: TIER_THRESHOLDS.legendary - newPoints };
  }

  // Update or create relationship record
  if (existingRelation) {
    await supabase
      .from('venue_relationships')
      .update({
        gigs_performed: gigsAtVenue,
        loyalty_points: newPoints,
        relationship_tier: tier,
        payout_bonus: payoutBonus,
        last_performance_date: new Date().toISOString()
      })
      .eq('band_id', bandId)
      .eq('venue_id', venueId);
  } else {
    await supabase
      .from('venue_relationships')
      .insert({
        band_id: bandId,
        venue_id: venueId,
        gigs_performed: 1,
        loyalty_points: pointsEarned,
        relationship_tier: tier,
        payout_bonus: payoutBonus,
        last_performance_date: new Date().toISOString()
      });
  }

  return {
    tier,
    loyaltyPoints: newPoints,
    gigsAtVenue,
    payoutBonus,
    tierBonuses: TIER_BONUSES[tier],
    nextTier,
    isNewVenue
  };
}
