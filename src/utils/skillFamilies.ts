export type SkillTier = "basic" | "professional" | "mastery";

export interface SkillFamilyEntry {
  slug: string;
  name: string;
  tier: SkillTier;
  maxLevel: number;
  level: number;
}

export interface SkillFamily {
  key: string;
  name: string;
  skills: SkillFamilyEntry[];
  completed: number;
}

const tierOrder: Record<SkillTier, number> = {
  basic: 0,
  professional: 1,
  mastery: 2,
};

/** Strip only complete tier tokens, not words such as professionalism. */
export function skillFamilyKey(slug: string): string {
  return slug.toLowerCase()
    .split("_")
    .filter((part) => part !== "basic" && part !== "professional" && part !== "mastery")
    .join("_");
}

/** Use the canonical tier when available; fall back for legacy entries. */
export function resolveSkillTier(slug: string, canonicalTier?: string | null): SkillTier {
  if (canonicalTier === "basic" || canonicalTier === "professional" || canonicalTier === "mastery") {
    return canonicalTier;
  }
  const tokens = slug.toLowerCase().split("_");
  if (tokens.includes("mastery")) return "mastery";
  if (tokens.includes("professional")) return "professional";
  return "basic";
}

export function groupSkillFamilies(entries: SkillFamilyEntry[]): SkillFamily[] {
  const groups = new Map<string, SkillFamily>();
  for (const entry of entries) {
    const key = skillFamilyKey(entry.slug);
    const group = groups.get(key) ?? {
      key,
      name: key.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
      skills: [],
      completed: 0,
    };
    group.skills.push(entry);
    if (entry.maxLevel > 0 && entry.level >= entry.maxLevel) group.completed++;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    skills: group.skills.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
