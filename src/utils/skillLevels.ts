import type { Tables } from "@/integrations/supabase/types";

export type SkillDefinitionRow = Tables<"skill_definitions">;
export type SkillLevelMap = Record<string, number>;

export interface SkillProgressWithDefinition {
  current_level: number | null;
  skill_id: string;
  skill_slug: string | null;
  skill_definitions?: {
    slug: string | null;
    name: string | null;
  } | null;
}

const titleFromSlug = (slug: string) =>
  slug
    .replace(/[-_]/g, " ")
    .split(" ")
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();

export const buildSkillLevelMap = (
  rows: SkillProgressWithDefinition[] | null | undefined,
  definitions: SkillDefinitionRow[]
): SkillLevelMap => {
  const slugById = new Map(
    definitions
      .filter(definition => definition.slug)
      .map(definition => [definition.id, definition.slug as string])
  );

  return (rows ?? []).reduce<SkillLevelMap>((accumulator, row) => {
    const slug =
      row.skill_definitions?.slug ??
      row.skill_slug ??
      (row.skill_id ? slugById.get(row.skill_id) ?? null : null);

    if (slug && typeof row.current_level === "number") {
      accumulator[slug] = row.current_level;
    }

    return accumulator;
  }, {});
};

export const getSkillLevel = <T extends number | string>(
  skillMap: SkillLevelMap | null | undefined,
  slug: string | null | undefined,
  fallback: T
): number | T => {
  if (!slug) {
    return fallback;
  }

  const level = skillMap?.[slug];
  return typeof level === "number" ? level : fallback;
};

export const getSkillLabel = (
  slug: string,
  definitions: SkillDefinitionRow[]
): string => {
  const definition = definitions.find(entry => entry.slug === slug);
  if (definition?.display_name) {
    return definition.display_name;
  }

  return titleFromSlug(slug);
};

export const getDefaultStrengths = (role: string): string[] => {
  const normalized = role.toLowerCase();
  if (normalized.includes("drum")) return ["Powerful beats", "Precise timing"];
  if (normalized.includes("bass")) return ["Solid groove", "Reliable foundation"];
  if (normalized.includes("keyboard")) return ["Arrangement skills", "Melodic layers"];
  if (normalized.includes("vocal")) return ["Stage charisma", "Audience connection"];
  if (normalized.includes("guitar")) return ["Creative riffs", "Showmanship"];
  return ["Team-focused", "Adaptable performer"];
};

export const collectSkillSlugs = (
  definitions: SkillDefinitionRow[],
  skillMap?: SkillLevelMap | null
): string[] => {
  const orderedSlugs = definitions
    .map(definition => definition.slug)
    .filter((slug): slug is string => Boolean(slug));

  if (skillMap) {
    Object.keys(skillMap).forEach(slug => {
      if (!orderedSlugs.includes(slug)) {
        orderedSlugs.push(slug);
      }
    });
  }

  return orderedSlugs;
};

export const estimateSkillTier = (
  skillMap: SkillLevelMap | null | undefined,
  definitions: SkillDefinitionRow[]
): number => {
  if (!skillMap) {
    return 1;
  }

  const values = (definitions.length > 0
    ? definitions
        .map(definition => {
          const slug = definition.slug;
          return slug ? skillMap[slug] : undefined;
        })
        .filter((value): value is number => typeof value === "number")
    : Object.values(skillMap).filter(
        (value): value is number => typeof value === "number"
      ));

  if (values.length === 0) {
    return 1;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(1, Math.round(average / 100));
};
