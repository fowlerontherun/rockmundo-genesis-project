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
