import { useMemo } from "react";
import { 
  calculateLevel, 
  experienceToNextLevel, 
  getLevelProgress, 
  getEffectiveXp,
  getCumulativeXpForLevel
} from "@/utils/gameBalance";
import type { PlayerXpWallet, PlayerSkills } from "@/hooks/useGameData";

interface PlayerLevelInput {
  xpWallet: PlayerXpWallet;
  skills: PlayerSkills | null;
  fame?: number | null;
  attributeStars?: number | null;
}

export interface PlayerLevelData {
  level: number;
  effectiveXp: number;
  xpToNextLevel: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  levelProgress: number; // 0-100%
  totalSkillLevels: number;
}

/**
 * Calculate the total of all skill levels for level contribution
 */
const calculateTotalSkillLevels = (skills: PlayerSkills | null): number => {
  if (!skills) return 0;
  
  let total = 0;
  for (const [key, value] of Object.entries(skills)) {
    // Skip metadata fields
    if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') {
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      total += value;
    }
  }
  return total;
};

/**
 * Hook to compute player level from combined progress sources.
 * Uses scaling XP curve and factors in:
 * - Lifetime XP from wallet
 * - Attribute stars
 * - Fame (1 XP per 100 fame)
 * - Total skill levels (2 XP per skill level)
 */
export const usePlayerLevel = (input: PlayerLevelInput): PlayerLevelData => {
  const { xpWallet, skills, fame, attributeStars } = input;

  return useMemo(() => {
    const totalSkillLevels = calculateTotalSkillLevels(skills);
    
    const additionalProgress = {
      fame: fame ?? 0,
      totalSkillLevels,
    };

    const wallet = xpWallet ? {
      lifetimeXp: xpWallet.lifetime_xp ?? 0,
      xpBalance: xpWallet.xp_balance ?? 0,
      xpSpent: xpWallet.xp_spent ?? 0,
      attributePointsEarned: xpWallet.attribute_points_earned ?? 0,
      skillPointsEarned: xpWallet.skill_points_earned ?? 0,
    } : null;

    const effectiveXp = getEffectiveXp(wallet, attributeStars, additionalProgress);
    const level = calculateLevel(wallet, attributeStars, additionalProgress);
    const xpToNextLevel = experienceToNextLevel(wallet, attributeStars, additionalProgress);
    const levelProgress = getLevelProgress(wallet, attributeStars, additionalProgress);
    const xpForCurrentLevel = getCumulativeXpForLevel(level);
    const xpForNextLevel = getCumulativeXpForLevel(level + 1);

    return {
      level,
      effectiveXp,
      xpToNextLevel,
      xpForCurrentLevel,
      xpForNextLevel,
      levelProgress,
      totalSkillLevels,
    };
  }, [xpWallet, skills, fame, attributeStars]);
};

/**
 * Standalone function to calculate level from progress data (for non-hook contexts)
 */
export const computePlayerLevel = (input: PlayerLevelInput): PlayerLevelData => {
  const { xpWallet, skills, fame, attributeStars } = input;
  const totalSkillLevels = calculateTotalSkillLevels(skills);
  
  const additionalProgress = {
    fame: fame ?? 0,
    totalSkillLevels,
  };

  const wallet = xpWallet ? {
    lifetimeXp: xpWallet.lifetime_xp ?? 0,
    xpBalance: xpWallet.xp_balance ?? 0,
    xpSpent: xpWallet.xp_spent ?? 0,
    attributePointsEarned: xpWallet.attribute_points_earned ?? 0,
    skillPointsEarned: xpWallet.skill_points_earned ?? 0,
  } : null;

  const effectiveXp = getEffectiveXp(wallet, attributeStars, additionalProgress);
  const level = calculateLevel(wallet, attributeStars, additionalProgress);
  const xpToNextLevel = experienceToNextLevel(wallet, attributeStars, additionalProgress);
  const levelProgress = getLevelProgress(wallet, attributeStars, additionalProgress);
  const xpForCurrentLevel = getCumulativeXpForLevel(level);
  const xpForNextLevel = getCumulativeXpForLevel(level + 1);

  return {
    level,
    effectiveXp,
    xpToNextLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    levelProgress,
    totalSkillLevels,
  };
};
