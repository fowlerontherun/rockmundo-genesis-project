import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QualityTier = "poor" | "basic" | "standard" | "premium" | "exclusive";

export interface MerchItemRequirement {
  id: string;
  item_type: string;
  category: string;
  min_fame: number;
  min_fans: number;
  min_level: number;
  base_quality_tier: QualityTier;
  base_cost: number;
  description: string | null;
  created_at: string;
}

export const QUALITY_TIERS: Record<QualityTier, {
  label: string;
  salesMultiplier: number;
  priceMultiplier: number;
  color: string;
}> = {
  poor: { label: "Poor", salesMultiplier: 0.5, priceMultiplier: 0.7, color: "text-muted-foreground" },
  basic: { label: "Basic", salesMultiplier: 0.75, priceMultiplier: 0.85, color: "text-blue-500" },
  standard: { label: "Standard", salesMultiplier: 1.0, priceMultiplier: 1.0, color: "text-green-500" },
  premium: { label: "Premium", salesMultiplier: 1.25, priceMultiplier: 1.15, color: "text-purple-500" },
  exclusive: { label: "Exclusive", salesMultiplier: 1.5, priceMultiplier: 1.3, color: "text-amber-500" },
};

export const useMerchRequirements = () => {
  return useQuery({
    queryKey: ["merch-item-requirements"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("merch_item_requirements")
        .select("*")
        .order("category", { ascending: true })
        .order("min_fame", { ascending: true });

      if (error) throw error;
      return (data || []) as MerchItemRequirement[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const checkMerchUnlocked = (
  requirement: MerchItemRequirement,
  playerFame: number,
  playerFans: number,
  playerLevel: number
): { unlocked: boolean; reason?: string } => {
  if (playerFame < requirement.min_fame) {
    return { unlocked: false, reason: `Requires ${requirement.min_fame.toLocaleString()} fame` };
  }
  if (playerFans < requirement.min_fans) {
    return { unlocked: false, reason: `Requires ${requirement.min_fans.toLocaleString()} fans` };
  }
  if (playerLevel < requirement.min_level) {
    return { unlocked: false, reason: `Requires level ${requirement.min_level}` };
  }
  return { unlocked: true };
};

export const getUnlockProgress = (
  requirement: MerchItemRequirement,
  playerFame: number,
  playerFans: number,
  playerLevel: number
): number => {
  const fameProgress = requirement.min_fame > 0 ? Math.min(playerFame / requirement.min_fame, 1) : 1;
  const fansProgress = requirement.min_fans > 0 ? Math.min(playerFans / requirement.min_fans, 1) : 1;
  const levelProgress = requirement.min_level > 0 ? Math.min(playerLevel / requirement.min_level, 1) : 1;
  
  // Average of all progress metrics
  return (fameProgress + fansProgress + levelProgress) / 3;
};

export const calculateMerchQuality = (
  baseQuality: QualityTier,
  bandFame: number,
  hasCustomDesign: boolean
): QualityTier => {
  const tiers: QualityTier[] = ["poor", "basic", "standard", "premium", "exclusive"];
  let tierIndex = tiers.indexOf(baseQuality);
  
  // Fame can upgrade quality (every 5000 fame = +1 tier potential)
  const fameBonus = Math.floor(bandFame / 5000);
  tierIndex = Math.min(tierIndex + fameBonus, tiers.length - 1);
  
  // Custom design gives +1 tier
  if (hasCustomDesign && tierIndex < tiers.length - 1) {
    tierIndex += 1;
  }
  
  return tiers[tierIndex];
};

/**
 * Calculate the recommended sale price for a merch item.
 * Formula: base_cost × 2.5 × qualityPriceMultiplier
 */
export const getRecommendedPrice = (
  baseCost: number,
  qualityTier: QualityTier
): number => {
  const qualityMultiplier = QUALITY_TIERS[qualityTier].priceMultiplier;
  return Math.round(baseCost * 2.5 * qualityMultiplier);
};

export type PricingImpact = {
  /** Ratio of actual price to recommended (1.0 = exactly recommended) */
  ratio: number;
  /** Multiplier applied to sales velocity (0.0 – 1.5) */
  salesMultiplier: number;
  /** Daily fame change caused by pricing (-2 to +1) */
  fameEffect: number;
  /** Daily fan change caused by pricing (-5 to +2) */
  fanEffect: number;
  /** Human-readable label */
  label: string;
  /** Semantic color class */
  color: string;
};

/**
 * Determine how a player's chosen price compares to the recommended price
 * and what impact that has on sales, fame, and fans.
 *
 * Pricing bands:
 *   ≤ 70%  → "Bargain"     : 1.4x sales, +1 fame/day, +2 fans/day  (leaving money on table)
 *   71-90% → "Underpriced"  : 1.2x sales, +0 fame, +1 fan/day
 *   91-110%→ "Fair Price"   : 1.0x sales, +0 fame, +0 fans
 *  111-130%→ "Overpriced"   : 0.6x sales, -1 fame/day, -2 fans/day
 *   >130%  → "Rip-off"      : 0.25x sales, -2 fame/day, -5 fans/day
 */
export const getPricingImpact = (
  actualPrice: number,
  recommendedPrice: number
): PricingImpact => {
  if (recommendedPrice <= 0) {
    return { ratio: 1, salesMultiplier: 1, fameEffect: 0, fanEffect: 0, label: "Fair Price", color: "text-green-500" };
  }

  const ratio = actualPrice / recommendedPrice;

  if (ratio <= 0.7) {
    return { ratio, salesMultiplier: 1.4, fameEffect: 1, fanEffect: 2, label: "Bargain", color: "text-blue-500" };
  }
  if (ratio <= 0.9) {
    return { ratio, salesMultiplier: 1.2, fameEffect: 0, fanEffect: 1, label: "Underpriced", color: "text-sky-500" };
  }
  if (ratio <= 1.1) {
    return { ratio, salesMultiplier: 1.0, fameEffect: 0, fanEffect: 0, label: "Fair Price", color: "text-green-500" };
  }
  if (ratio <= 1.3) {
    return { ratio, salesMultiplier: 0.6, fameEffect: -1, fanEffect: -2, label: "Overpriced", color: "text-amber-500" };
  }
  return { ratio, salesMultiplier: 0.25, fameEffect: -2, fanEffect: -5, label: "Rip-off", color: "text-destructive" };
};
