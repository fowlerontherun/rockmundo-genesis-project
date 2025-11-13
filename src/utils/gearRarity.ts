export type GearRarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

const RARITY_LABELS: Record<GearRarityKey, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const rarityStyles: Record<GearRarityKey, string> = {
  common: "border-muted bg-muted/40 text-muted-foreground",
  uncommon: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  rare: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  epic: "border-purple-500/40 bg-purple-500/10 text-purple-600",
  legendary: "border-amber-500/40 bg-amber-500/10 text-amber-600",
};

export const parseRarityKey = (rarity: string | null | undefined): GearRarityKey => {
  const normalized = typeof rarity === "string" ? rarity.toLowerCase().trim() : "";

  if (normalized === "uncommon" || normalized === "rare" || normalized === "epic" || normalized === "legendary") {
    return normalized;
  }

  return "common";
};

export const getRarityLabel = (rarity: string | null | undefined) => RARITY_LABELS[parseRarityKey(rarity)];
