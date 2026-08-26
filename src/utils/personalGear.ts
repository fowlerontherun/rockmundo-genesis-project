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
  return Math.max(0, Math.round(rarityBonus + (Number.isFinite(performance) ? performance : 0)));
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
