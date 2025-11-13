export type GearQualityTier = "budget" | "standard" | "professional" | "boutique" | "experimental";

const QUALITY_LABELS: Record<GearQualityTier, string> = {
  budget: "Budget",
  standard: "Standard",
  professional: "Professional",
  boutique: "Boutique",
  experimental: "Experimental",
};

export const qualityTierStyles: Record<GearQualityTier, string> = {
  budget: "border-muted bg-muted/40 text-muted-foreground",
  standard: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  professional: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  boutique: "border-purple-500/30 bg-purple-500/10 text-purple-600",
  experimental: "border-amber-500/30 bg-amber-500/10 text-amber-600",
};

const calculateBoostTotal = (statBoosts?: Record<string, number> | null) => {
  if (!statBoosts) {
    return 0;
  }

  return Object.values(statBoosts).reduce((total, value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return total;
    }

    return total + value;
  }, 0);
};

export const deriveQualityTier = (
  cashPrice: number | null | undefined,
  statBoosts?: Record<string, number> | null
): GearQualityTier => {
  const normalizedPrice = typeof cashPrice === "number" && Number.isFinite(cashPrice) ? cashPrice : 0;
  const boostTotal = calculateBoostTotal(statBoosts);

  if (boostTotal >= 40 || normalizedPrice >= 6000) {
    return "experimental";
  }

  if (boostTotal >= 28 || normalizedPrice >= 4000) {
    return "boutique";
  }

  if (boostTotal >= 18 || normalizedPrice >= 2200) {
    return "professional";
  }

  if (boostTotal >= 10 || normalizedPrice >= 1000) {
    return "standard";
  }

  return "budget";
};

export const getQualityLabel = (tier: GearQualityTier) => QUALITY_LABELS[tier];
