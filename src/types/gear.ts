export interface GearCategory {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  sort_order: number | null;
}

export interface EquipmentItemRecord {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  stock: number | null;
  image_url?: string | null;
  created_at?: string;
}

export type EquipmentCurrencyCost = {
  cash: number;
  fame: number;
};

export const normalizeEquipmentStatBoosts = (
  value: unknown
): Record<string, number> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entries: Array<[string, number]> = [];

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numericValue = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    entries.push([key, numericValue]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : null;
};
