export const PERSONAL_GEAR_RARITY_BONUS: Record<string, number> = {
  common: 5,
  uncommon: 10,
  rare: 18,
  epic: 25,
  legendary: 35,
};

const ROLE_GEAR_CATEGORIES: Record<string, string[]> = {
  "Lead Guitar": ["guitar", "electric_guitar"],
  "Rhythm Guitar": ["guitar", "acoustic_guitar", "electric_guitar"],
  Bass: ["bass"],
  Drums: ["drums"],
  Vocals: ["microphone"],
  "Lead Vocals": ["microphone"],
  Keys: ["keyboard", "piano"],
  Keyboard: ["keyboard", "piano", "synth"],
  Synth: ["synth", "keyboard"],
  DJ: ["dj", "controller"],
  Saxophone: ["wind", "saxophone"],
  Trumpet: ["brass", "trumpet"],
  Trombone: ["brass", "trombone"],
  Violin: ["strings", "violin"],
  Cello: ["strings", "cello"],
  Percussion: ["percussion", "drums"],
};

export interface PersonalGearItemLike {
  category?: string | null;
  subcategory?: string | null;
  rarity?: string | null;
  stat_boosts?: Record<string, unknown> | null;
}

const LUTHIERY_PERFORMANCE_KEYS = [
  "luthiery_tone",
  "luthiery_sustain",
  "luthiery_stability",
  "luthiery_output",
  "luthiery_stage_presence",
] as const;

/**
 * Crafted Luthiery stats are absolute 0-100 craft characteristics, not direct
 * percentage modifiers. Convert their average to a small, bounded role bonus
 * so they matter without being counted again in the shared-equipment score.
 */
export function getLuthieryPerformanceBonusPercent(
  boosts: Record<string, unknown> | null | undefined,
): number {
  if (!boosts) return 0;
  const values = LUTHIERY_PERFORMANCE_KEYS
    .map((key) => Number(boosts[key]))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, Math.min(100, value)));
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0, Math.min(8, Math.round(average / 12.5)));
}

export function personalGearMatchesRole(
  category: string | null | undefined,
  subcategory: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!role || !category) return false;

  const direct = ROLE_GEAR_CATEGORIES[role];
  const matchedRole = direct
    ? role
    : Object.keys(ROLE_GEAR_CATEGORIES).find(
        (candidate) =>
          role.toLowerCase().includes(candidate.toLowerCase()) ||
          candidate.toLowerCase().includes(role.toLowerCase()),
      );

  const validCategories = matchedRole ? ROLE_GEAR_CATEGORIES[matchedRole] : [];
  const categoryLower = category.toLowerCase();
  const subcategoryLower = (subcategory || "").toLowerCase();

  return validCategories.some(
    (valid) =>
      categoryLower.includes(valid) ||
      subcategoryLower.includes(valid) ||
      valid.includes(categoryLower),
  );
}

/**
 * Mirrors the per-item portion of process-gig-song's personal gear calculation.
 * The live scorer caps the combined equipped-gear bonus at +50%.
 */
export function getPersonalGearRoleBonusPercent(
  item: PersonalGearItemLike,
  role: string | null | undefined,
): number {
  if (!personalGearMatchesRole(item.category, item.subcategory, role)) return 0;

  const rarityBonus = PERSONAL_GEAR_RARITY_BONUS[(item.rarity || "common").toLowerCase()] ?? 5;
  const performance = Number(item.stat_boosts?.performance || 0);
  const craftedLuthieryBonus = item.subcategory === "custom_luthiery"
    ? getLuthieryPerformanceBonusPercent(item.stat_boosts)
    : 0;
  return Math.max(
    0,
    Math.round(
      rarityBonus +
      (Number.isFinite(performance) ? performance : 0) +
      craftedLuthieryBonus,
    ),
  );
}

export function getPersonalGearFitLabel(
  item: PersonalGearItemLike,
  role: string | null | undefined,
): string {
  if (!role) return "Set a band role to see fit";
  return personalGearMatchesRole(item.category, item.subcategory, role)
    ? `Fits ${role}`
    : `Not used for ${role}`;
}
