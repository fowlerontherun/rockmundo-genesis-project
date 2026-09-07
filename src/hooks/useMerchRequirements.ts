import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QualityTier = "poor" | "basic" | "standard" | "premium" | "exclusive";
export type MerchProductKind = "physical" | "digital" | "experience";

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
  product_kind?: MerchProductKind;
  base_material?: string | null;
  supplier_tier?: string;
  min_order_qty?: number;
  lead_time_days?: number;
  is_personalisable?: boolean;
  print_areas?: string[];
  colour_options?: string[];
  catalog_source?: string;
  catalog_source_ref?: string | null;
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
        .order("base_cost", { ascending: true });

      if (error) throw error;
      return (data || []) as MerchItemRequirement[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Normal physical and digital merchandise is available to every band. Fame/fans/level
 * gates are reserved for experiences and genuinely prestige-based products. Demand,
 * not the ability to buy a blank T-shirt, is where fame should matter.
 */
export const checkMerchUnlocked = (
  requirement: MerchItemRequirement,
  playerFame: number,
  playerFans: number,
  playerLevel: number
): { unlocked: boolean; reason?: string } => {
  const kind = requirement.product_kind ?? (requirement.category === "Experiences" ? "experience" : "physical");
  if (kind !== "experience") return { unlocked: true };

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
  if ((requirement.product_kind ?? "physical") !== "experience") return 1;
  const fameProgress = requirement.min_fame > 0 ? Math.min(playerFame / requirement.min_fame, 1) : 1;
  const fansProgress = requirement.min_fans > 0 ? Math.min(playerFans / requirement.min_fans, 1) : 1;
  const levelProgress = requirement.min_level > 0 ? Math.min(playerLevel / requirement.min_level, 1) : 1;
  return (fameProgress + fansProgress + levelProgress) / 3;
};

/**
 * Manufacturing quality comes from the selected product/supplier. Fame and artwork no
 * longer upgrade the physical garment behind the scenes.
 */
export const calculateMerchQuality = (
  baseQuality: QualityTier,
  _bandFame: number,
  _hasCustomDesign: boolean
): QualityTier => baseQuality;

export const getRecommendedPrice = (
  baseCost: number,
  qualityTier: QualityTier
): number => {
  const qualityMultiplier = QUALITY_TIERS[qualityTier].priceMultiplier;
  const digitalFloorPrices: Record<QualityTier, number> = {
    poor: 2,
    basic: 5,
    standard: 8,
    premium: 12,
    exclusive: 20,
  };

  if (baseCost <= 0) {
    return Math.round(digitalFloorPrices[qualityTier] * qualityMultiplier);
  }
  return Math.round(baseCost * 2.5 * qualityMultiplier);
};

export const MAX_MERCH_PRICE = 9999;

export type PricingImpact = {
  ratio: number;
  salesMultiplier: number;
  fameEffect: number;
  fanEffect: number;
  label: string;
  color: string;
};

export const getPricingImpact = (
  actualPrice: number,
  recommendedPrice: number
): PricingImpact => {
  const effectiveRecommended = Math.max(recommendedPrice, 5);
  const ratio = actualPrice / effectiveRecommended;

  if (ratio <= 0.7) return { ratio, salesMultiplier: 1.4, fameEffect: 1, fanEffect: 2, label: "Bargain", color: "text-blue-500" };
  if (ratio <= 0.9) return { ratio, salesMultiplier: 1.2, fameEffect: 0, fanEffect: 1, label: "Underpriced", color: "text-sky-500" };
  if (ratio <= 1.1) return { ratio, salesMultiplier: 1.0, fameEffect: 0, fanEffect: 0, label: "Fair Price", color: "text-green-500" };
  if (ratio <= 1.3) return { ratio, salesMultiplier: 0.6, fameEffect: -1, fanEffect: -2, label: "Overpriced", color: "text-amber-500" };
  return { ratio, salesMultiplier: 0.25, fameEffect: -2, fanEffect: -5, label: "Rip-off", color: "text-destructive" };
};
