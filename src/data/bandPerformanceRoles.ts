import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";

const BASIC_TIER = "Basic";
const PERFORMANCE_CATEGORY = "Instruments & Performance";
const EXTRA_PERFORMANCE_SLUGS = new Set([
  "basic_singing",
  "basic_rapping",
  "vocals",
]);

const roleFromDefinition = (definition: SkillDefinitionRecord): string | null => {
  const metadata = definition.metadata as { category?: string; tier?: string } | null | undefined;
  const isInstrumentPerformance = metadata?.category === PERFORMANCE_CATEGORY && metadata?.tier === BASIC_TIER;
  const isLegacyVocalPerformance = EXTRA_PERFORMANCE_SLUGS.has(definition.slug);

  if (!isInstrumentPerformance && !isLegacyVocalPerformance) return null;

  const role = definition.display_name.replace(/^Basic\s+/i, "").trim();
  return role || null;
};

export const BAND_PERFORMANCE_ROLES = Array.from(
  new Set(
    (SKILL_TREE_DEFINITIONS as SkillDefinitionRecord[])
      .map(roleFromDefinition)
      .filter((role): role is string => Boolean(role)),
  ),
).sort((a, b) => a.localeCompare(b));

export const DEFAULT_BAND_PERFORMANCE_ROLE =
  BAND_PERFORMANCE_ROLES.find((role) => role === "Electric Guitar")
  ?? BAND_PERFORMANCE_ROLES.find((role) => role.includes("Guitar"))
  ?? BAND_PERFORMANCE_ROLES[0]
  ?? "Guitar";

export const BAND_VOCAL_ASSIGNMENTS = ["Lead Vocals", "Backing Vocals", "None"] as const;

export function isBandPerformanceRole(value: string | null | undefined): value is string {
  return Boolean(value && BAND_PERFORMANCE_ROLES.includes(value));
}
