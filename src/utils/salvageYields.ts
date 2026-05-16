import type { CraftingMaterial } from "@/hooks/useCraftingSystem";

export interface SalvageYield {
  materialId: string;
  material: CraftingMaterial;
  quantity: number;
}

const RARITY_PLAN: Record<string, { picks: number; baseQty: number; preferRare: boolean }> = {
  common:    { picks: 1, baseQty: 1, preferRare: false },
  uncommon:  { picks: 1, baseQty: 2, preferRare: false },
  rare:      { picks: 2, baseQty: 2, preferRare: false },
  epic:      { picks: 2, baseQty: 3, preferRare: true },
  legendary: { picks: 3, baseQty: 3, preferRare: true },
};

const CATEGORY_HINTS: Record<string, string[]> = {
  guitar: ["wood", "hardware"],
  bass: ["wood", "hardware"],
  drums: ["wood", "hardware"],
  keyboard: ["electronics", "hardware"],
  microphone: ["electronics", "hardware"],
  amplifier: ["electronics", "hardware"],
  amp: ["electronics", "hardware"],
  pedal: ["electronics"],
  cable: ["electronics"],
};

/**
 * Deterministic-ish salvage yields based on the equipment's rarity, condition,
 * and category. Uses equipment id as a seed so previewed yields match the
 * yields awarded on confirm.
 */
export function computeSalvageYields(
  equipment: {
    id: string;
    condition?: number | null;
    is_equipped?: boolean | null;
    equipment?: {
      rarity?: string | null;
      category?: string | null;
    } | null;
  },
  materialsCatalog: CraftingMaterial[],
): SalvageYield[] {
  if (!materialsCatalog.length) return [];

  const rarity = (equipment.equipment?.rarity ?? "common").toLowerCase();
  const plan = RARITY_PLAN[rarity] ?? RARITY_PLAN.common;
  const condition = Math.max(0, Math.min(100, equipment.condition ?? 100));
  const conditionMult = Math.max(0.25, condition / 100);

  const category = (equipment.equipment?.category ?? "").toLowerCase();
  const preferredCats = CATEGORY_HINTS[category] ?? [];

  // Stable seed from id
  let seed = 0;
  for (const ch of equipment.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Rank materials: preferred category first, then rare-tier if plan asks
  const ranked = [...materialsCatalog].sort((a, b) => {
    const aPref = preferredCats.includes(a.category) ? 0 : 1;
    const bPref = preferredCats.includes(b.category) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    if (plan.preferRare) {
      return (b.quality_tier ?? 1) - (a.quality_tier ?? 1);
    }
    return (a.quality_tier ?? 1) - (b.quality_tier ?? 1);
  });

  const picks: SalvageYield[] = [];
  const seen = new Set<string>();
  const candidatePool = ranked.slice(0, Math.max(plan.picks * 3, 4));

  while (picks.length < plan.picks && candidatePool.length > 0) {
    const idx = Math.floor(rand() * candidatePool.length);
    const mat = candidatePool[idx];
    if (!mat || seen.has(mat.id)) {
      candidatePool.splice(idx, 1);
      continue;
    }
    seen.add(mat.id);
    const qty = Math.max(1, Math.round(plan.baseQty * conditionMult));
    picks.push({ materialId: mat.id, material: mat, quantity: qty });
    candidatePool.splice(idx, 1);
  }

  return picks;
}
