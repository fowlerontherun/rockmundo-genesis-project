/**
 * Achievement Reward Distribution (v1.0.931)
 * Maps achievements to tangible rewards: cash, XP, fame, and unlocks.
 */

import { supabase } from "@/integrations/supabase/client";

export interface AchievementReward {
  cash: number;
  xp: number;
  fame: number;
  unlockKey?: string;     // e.g. "venue_tier_3", "clothing_premium"
  title?: string;         // cosmetic title for profile
}

// Rarity-based reward tiers
const RARITY_REWARDS: Record<string, AchievementReward> = {
  common: { cash: 100, xp: 50, fame: 5 },
  uncommon: { cash: 500, xp: 150, fame: 15 },
  rare: { cash: 2000, xp: 500, fame: 50 },
  epic: { cash: 10000, xp: 2000, fame: 200 },
  legendary: { cash: 50000, xp: 10000, fame: 1000, title: "Legend" },
};

// Category-specific bonus rewards
const CATEGORY_BONUSES: Record<string, Partial<AchievementReward>> = {
  performance: { fame: 25 },
  recording: { xp: 100 },
  social: { cash: 200 },
  touring: { cash: 500, fame: 15 },
  business: { cash: 1000 },
  creative: { xp: 200 },
  milestone: { fame: 50, cash: 500 },
};

/**
 * Calculate rewards for an achievement based on its rarity and category.
 */
export function calculateAchievementReward(
  rarity: string,
  category: string | null
): AchievementReward {
  const base = RARITY_REWARDS[rarity] ?? RARITY_REWARDS.common;
  const bonus = category ? (CATEGORY_BONUSES[category] ?? {}) : {};

  return {
    cash: base.cash + (bonus.cash ?? 0),
    xp: base.xp + (bonus.xp ?? 0),
    fame: base.fame + (bonus.fame ?? 0),
    unlockKey: base.unlockKey ?? bonus.unlockKey,
    title: base.title ?? bonus.title,
  };
}

/**
 * Grant achievement rewards to a player.
 */
export async function grantAchievementRewards(
  userId: string,
  bandId: string | null,
  achievementId: string,
  rarity: string,
  category: string | null
): Promise<AchievementReward> {
  const reward = calculateAchievementReward(rarity, category);

  // Grant cash
  if (reward.cash > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("cash")
      .eq("id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) + reward.cash })
        .eq("id", userId);
    }
  }

  // Grant fame to band
  if (reward.fame > 0 && bandId) {
    const { data: band } = await supabase
      .from("bands")
      .select("fame")
      .eq("id", bandId)
      .single();

    if (band) {
      await supabase
        .from("bands")
        .update({ fame: (band.fame || 0) + reward.fame })
        .eq("id", bandId);
    }

    // Log fame event
    await supabase.from("band_fame_events").insert({
      band_id: bandId,
      event_type: "achievement_unlock",
      fame_gained: reward.fame,
      event_data: { achievement_id: achievementId, rarity },
    });
  }

  // Log activity
  await supabase.from("activity_feed").insert({
    user_id: userId,
    activity_type: "achievement_reward",
    message: `Achievement unlocked! Earned $${reward.cash.toLocaleString()}, ${reward.xp} XP, and ${reward.fame} fame.`,
    earnings: reward.cash,
    metadata: { achievement_id: achievementId, reward },
  });

  return reward;
}
