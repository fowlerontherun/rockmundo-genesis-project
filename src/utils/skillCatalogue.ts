import { supabase } from "@/integrations/supabase/client";
import {
  ATTRIBUTE_MAX_VALUE,
  FULL_ATTRIBUTE_KEYS,
  FULL_ATTRIBUTE_METADATA,
  type FullAttributeKey,
} from "./attributeProgression";
import { PROGRESSION_BALANCE, getDiminishingAttributeEffect } from "./progressionBalance";

export const SKILL_TYPES = [
  "foundation",
  "instrument",
  "vocal",
  "performance",
  "songwriting",
  "theory",
  "production",
  "genre",
  "business",
  "social",
  "health",
  "teaching",
  "craft",
  "specialist",
  "mastery",
] as const;
export const SKILL_SYSTEM_KEYS = [
  "skill_learning",
  "rehearsal",
  "songwriting",
  "recording",
  "live_gig",
  "touring",
  "education",
  "teaching",
  "business",
  "social_media",
  "interviews",
  "equipment_crafting",
  "wellness",
] as const;
export const SKILL_ROLE_KEYS = [
  "lead_vocalist",
  "backing_vocalist",
  "lead_guitarist",
  "rhythm_guitarist",
  "bassist",
  "drummer",
  "keyboard_player",
  "dj",
  "producer",
  "songwriter",
  "bandleader",
  "live_frontperson",
  "sound_engineer",
] as const;
export type SkillType = (typeof SKILL_TYPES)[number];
export type SkillSystemKey = (typeof SKILL_SYSTEM_KEYS)[number];
export type SkillRoleKey = (typeof SKILL_ROLE_KEYS)[number];
export type SkillAvailabilityStatus =
  | "unlocked"
  | "available_to_unlock"
  | "prerequisites_missing"
  | "hidden"
  | "inactive"
  | "maxed";
export type RelationshipType =
  | "learning_speed"
  | "effectiveness"
  | "unlock_requirement"
  | "consistency"
  | "fatigue_resistance";

export interface CanonicalSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  tier: "basic" | "professional" | "mastery";
  skill_type: SkillType;
  is_active: boolean;
  is_hidden: boolean;
  is_practiceable: boolean;
  is_foundational: boolean;
  max_level: number;
  progression_curve_key: string;
  display_order: number;
  icon_key: string | null;
  supports_mastery?: boolean;
  mastery_category?: string | null;
  mastery_rank_cap?: number | null;
  mastery_curve_key?: string | null;
  mastery_unlock_requirements?: unknown[];
  mastery_display_order?: number | null;
}
export interface SkillAttributeLink {
  skill_slug: string;
  attribute_key: FullAttributeKey;
  relationship_type: RelationshipType;
  weight: number;
  max_bonus: number;
  is_primary: boolean;
}
export interface SkillPrerequisite {
  skill_slug: string;
  prerequisite_skill_slug: string;
  required_level: number;
  prerequisite_type: "required" | "one_of" | "recommended" | "hidden_unlock";
}
export interface SkillUnlockRoute {
  skill_slug: string;
  route_type:
    | "starter"
    | "lesson"
    | "university_course"
    | "activity"
    | "rehearsal"
    | "performance"
    | "book"
    | "admin"
    | "hidden_discovery";
  source_key: string;
  minimum_source_level: number;
  unlock_level: number;
  is_active: boolean;
}
export interface SkillSystemLink {
  skill_slug: string;
  system_key: SkillSystemKey;
  usage_type:
    | "primary"
    | "secondary"
    | "prerequisite"
    | "modifier"
    | "unlock"
    | "recommendation";
  weight: number;
}
export interface SkillRoleLink {
  skill_slug: string;
  role_key: SkillRoleKey;
  relevance: "primary" | "secondary" | "supporting";
  weight: number;
  minimum_recommended_level: number;
}
export interface SkillBlockedReason {
  code: string;
  message: string;
  missingRequirements?: Array<{
    skillSlug: string;
    requiredLevel: number;
    currentLevel: number;
  }>;
}
export interface SkillAvailability {
  slug: string;
  status: SkillAvailabilityStatus;
  blockedReason?: SkillBlockedReason;
}

export const CANONICAL_SKILLS: CanonicalSkill[] = [
  {
    id: "guitar",
    slug: "guitar",
    name: "Guitar Mastery",
    description: "Ability to perform and improvise on guitar across genres.",
    category: "Instruments",
    subcategory: "Strings",
    tier: "basic",
    skill_type: "instrument",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: true,
    max_level: 100,
    progression_curve_key: "foundation_fast",
    display_order: 10,
    icon_key: "guitar",
    supports_mastery: true,
    mastery_category: "instrument",
    mastery_rank_cap: 4,
    mastery_curve_key: "mastery_professional",
    mastery_unlock_requirements: [{ type: "primary_skill_level", sourceKey: "guitar", requiredValue: 100 }],
    mastery_display_order: 10,
  },
  {
    id: "vocals",
    slug: "vocals",
    name: "Vocal Performance",
    description: "Pitch, range and delivery for vocal performances.",
    category: "Performance",
    subcategory: "Vocals",
    tier: "basic",
    skill_type: "vocal",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: true,
    max_level: 100,
    progression_curve_key: "foundation_fast",
    display_order: 20,
    icon_key: "mic",
    supports_mastery: true,
    mastery_category: "vocal",
    mastery_rank_cap: 4,
    mastery_curve_key: "mastery_professional",
    mastery_unlock_requirements: [{ type: "primary_skill_level", sourceKey: "vocals", requiredValue: 100 }],
    mastery_display_order: 20,
  },
  {
    id: "drums",
    slug: "drums",
    name: "Percussion Skills",
    description: "Timing, groove and creativity behind the kit.",
    category: "Instruments",
    subcategory: "Percussion",
    tier: "basic",
    skill_type: "instrument",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: true,
    max_level: 100,
    progression_curve_key: "foundation_fast",
    display_order: 30,
    icon_key: "drums",
  },
  {
    id: "bass",
    slug: "bass",
    name: "Bass Groove",
    description: "Low-end control and groove crafting for any ensemble.",
    category: "Instruments",
    subcategory: "Strings",
    tier: "basic",
    skill_type: "instrument",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: true,
    max_level: 100,
    progression_curve_key: "foundation_fast",
    display_order: 40,
    icon_key: "bass",
  },
  {
    id: "performance",
    slug: "performance",
    name: "Stage Presence",
    description: "Crowd engagement, stamina and live showmanship.",
    category: "Stage",
    subcategory: "Showmanship",
    tier: "basic",
    skill_type: "performance",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: false,
    max_level: 100,
    progression_curve_key: "standard_role",
    display_order: 50,
    icon_key: "stage",
  },
  {
    id: "songwriting",
    slug: "songwriting",
    name: "Songwriting",
    description: "Lyricism, melody crafting and song structure.",
    category: "Songwriting",
    subcategory: "Composition",
    tier: "basic",
    skill_type: "songwriting",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: true,
    max_level: 100,
    progression_curve_key: "foundation_fast",
    display_order: 60,
    icon_key: "pen",
    supports_mastery: true,
    mastery_category: "creative",
    mastery_rank_cap: 4,
    mastery_curve_key: "mastery_elite",
    mastery_unlock_requirements: [{ type: "primary_skill_level", sourceKey: "songwriting", requiredValue: 100 }],
    mastery_display_order: 30,
  },
  {
    id: "composition",
    slug: "composition",
    name: "Music Composition",
    description: "Arranging complex pieces and orchestrating multi-part works.",
    category: "Songwriting",
    subcategory: "Arrangement",
    tier: "professional",
    skill_type: "theory",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: false,
    max_level: 100,
    progression_curve_key: "specialist",
    display_order: 70,
    icon_key: "music",
  },
  {
    id: "technical",
    slug: "technical",
    name: "Technical Production",
    description: "Studio technology, mixing and engineering expertise.",
    category: "Production",
    subcategory: "Studio",
    tier: "professional",
    skill_type: "production",
    is_active: true,
    is_hidden: false,
    is_practiceable: true,
    is_foundational: false,
    max_level: 100,
    progression_curve_key: "specialist",
    display_order: 80,
    icon_key: "sliders",
  },
];

export const CANONICAL_ATTRIBUTE_LINKS: SkillAttributeLink[] = [
  ["guitar", "musical_ability", 0.7],
  ["guitar", "musicality", 0.3],
  ["bass", "musical_ability", 0.6],
  ["bass", "rhythm_sense", 0.4],
  ["drums", "rhythm_sense", 0.7],
  ["drums", "musicality", 0.3],
  ["vocals", "vocal_talent", 0.7],
  ["vocals", "musicality", 0.3],
  ["performance", "stage_presence", 0.6],
  ["performance", "crowd_engagement", 0.4],
  ["songwriting", "creative_insight", 0.6],
  ["songwriting", "musicality", 0.4],
  ["composition", "musicality", 0.6],
  ["composition", "mental_focus", 0.4],
  ["technical", "technical_mastery", 0.7],
  ["technical", "creative_insight", 0.3],
].map(([skill_slug, attribute_key, weight], index) => ({
  skill_slug: skill_slug as string,
  attribute_key: attribute_key as FullAttributeKey,
  relationship_type: "learning_speed",
  weight: weight as number,
  max_bonus: 0.5,
  is_primary: index % 2 === 0,
}));
export const CANONICAL_PREREQUISITES: SkillPrerequisite[] = [
  {
    skill_slug: "composition",
    prerequisite_skill_slug: "songwriting",
    required_level: 20,
    prerequisite_type: "required",
  },
  {
    skill_slug: "technical",
    prerequisite_skill_slug: "performance",
    required_level: 15,
    prerequisite_type: "recommended",
  },
];
export const CANONICAL_UNLOCK_ROUTES: SkillUnlockRoute[] = CANONICAL_SKILLS.map(
  (s) => ({
    skill_slug: s.slug,
    route_type: s.is_foundational ? "starter" : "university_course",
    source_key: s.is_foundational ? "new_profile" : s.slug,
    minimum_source_level: 0,
    unlock_level: s.is_foundational ? 0 : 1,
    is_active: true,
  }),
);
export const CANONICAL_SYSTEM_LINKS: SkillSystemLink[] = [
  ["guitar", "recording", "primary"],
  ["guitar", "live_gig", "primary"],
  ["bass", "recording", "primary"],
  ["bass", "live_gig", "primary"],
  ["drums", "recording", "primary"],
  ["drums", "live_gig", "primary"],
  ["vocals", "recording", "primary"],
  ["vocals", "live_gig", "primary"],
  ["performance", "live_gig", "primary"],
  ["songwriting", "songwriting", "primary"],
  ["composition", "songwriting", "modifier"],
  ["technical", "recording", "primary"],
].map(([skill_slug, system_key, usage_type]) => ({
  skill_slug: skill_slug as string,
  system_key: system_key as SkillSystemKey,
  usage_type: usage_type as SkillSystemLink["usage_type"],
  weight: 1,
}));
export const CANONICAL_ROLE_LINKS: SkillRoleLink[] = [
  ["guitar", "lead_guitarist"],
  ["guitar", "rhythm_guitarist"],
  ["bass", "bassist"],
  ["drums", "drummer"],
  ["vocals", "lead_vocalist"],
  ["vocals", "backing_vocalist"],
  ["performance", "live_frontperson"],
  ["songwriting", "songwriter"],
  ["composition", "songwriter"],
  ["technical", "producer"],
  ["technical", "sound_engineer"],
].map(([skill_slug, role_key]) => ({
  skill_slug: skill_slug as string,
  role_key: role_key as SkillRoleKey,
  relevance: "primary",
  weight: 1,
  minimum_recommended_level: 10,
}));

export const getSkillBySlug = (slug: string) =>
  CANONICAL_SKILLS.find((s) => s.slug === slug);
export const getSkillsByCategory = (category: string) =>
  CANONICAL_SKILLS.filter(
    (s) => s.category.toLowerCase() === category.toLowerCase(),
  );
export const getSkillPrerequisites = (slug: string) =>
  CANONICAL_PREREQUISITES.filter((p) => p.skill_slug === slug);
export const getSkillAttributeLinks = (
  slug: string,
  relationshipType: RelationshipType = "learning_speed",
) =>
  CANONICAL_ATTRIBUTE_LINKS.filter(
    (l) => l.skill_slug === slug && l.relationship_type === relationshipType,
  );
export const getSkillUnlockRoutes = (slug: string) =>
  CANONICAL_UNLOCK_ROUTES.filter((r) => r.skill_slug === slug && r.is_active);
export const getSkillSystemLinks = (slug: string) =>
  CANONICAL_SYSTEM_LINKS.filter((l) => l.skill_slug === slug);
export const getSkillRoleLinks = (slug: string) =>
  CANONICAL_ROLE_LINKS.filter((l) => l.skill_slug === slug);
export const getAttributeLabel = (key: FullAttributeKey) =>
  FULL_ATTRIBUTE_METADATA[key]?.label ?? key;

export function calculateWeightedLearningMultiplier(
  skillSlug: string,
  attributes: Record<string, unknown> | null | undefined,
  links = getSkillAttributeLinks(skillSlug),
) {
  if (!attributes || links.length === 0)
    return { multiplier: 1, boostPercent: 0, attributeNames: [] };
  const bonus = links.reduce((sum, link) => {
    const rawValue = Math.max(
      0,
      Math.min(ATTRIBUTE_MAX_VALUE, Number(attributes[link.attribute_key]) || 0),
    );
    const relationshipCap = link.is_primary
      ? PROGRESSION_BALANCE.learning.primaryMaxBonus
      : PROGRESSION_BALANCE.learning.secondaryMaxBonus;
    return sum + getDiminishingAttributeEffect(rawValue) * relationshipCap * link.weight;
  }, 0);
  const cappedBonus = Math.min(bonus, PROGRESSION_BALANCE.learning.totalAttributeBonusCap);
  return {
    multiplier: Number((1 + cappedBonus).toFixed(3)),
    boostPercent: Math.round(cappedBonus * 100),
    attributeNames: links.map((l) => l.attribute_key),
  };
}

export function getBlockedReasonForSkill(
  progress: Record<string, number>,
  slug: string,
): SkillBlockedReason | undefined {
  const missing = getSkillPrerequisites(slug)
    .filter(
      (p) =>
        p.prerequisite_type === "required" &&
        (progress[p.prerequisite_skill_slug] ?? 0) < p.required_level,
    )
    .map((p) => ({
      skillSlug: p.prerequisite_skill_slug,
      requiredLevel: p.required_level,
      currentLevel: progress[p.prerequisite_skill_slug] ?? 0,
    }));
  return missing.length
    ? {
        code: "PREREQUISITE_LEVEL_TOO_LOW",
        message: `Requires ${getSkillBySlug(missing[0].skillSlug)?.name ?? missing[0].skillSlug} level ${missing[0].requiredLevel}`,
        missingRequirements: missing,
      }
    : undefined;
}
export function getAvailabilityForSkill(
  progress: Record<string, number>,
  slug: string,
): SkillAvailability {
  const skill = getSkillBySlug(slug);
  if (!skill)
    return {
      slug,
      status: "inactive",
      blockedReason: {
        code: "SKILL_NOT_IN_CATALOGUE",
        message: "Skill is not in the canonical catalogue.",
      },
    };
  if (!skill.is_active) return { slug, status: "inactive" };
  if (skill.is_hidden && !progress[slug]) return { slug, status: "hidden" };
  const level = progress[slug] ?? 0;
  if (level >= skill.max_level) return { slug, status: "maxed" };
  if (level > 0 || skill.is_foundational) return { slug, status: "unlocked" };
  const blockedReason = getBlockedReasonForSkill(progress, slug);
  return blockedReason
    ? { slug, status: "prerequisites_missing", blockedReason }
    : { slug, status: "available_to_unlock" };
}

export async function fetchCanonicalSkillCatalogue() {
  const { data, error } = await (supabase as any)
    .from("skill_catalogue_view")
    .select("*")
    .order("display_order");
  if (error || !data?.length) return CANONICAL_SKILLS;
  return data.map((row: any) => ({
    ...getSkillBySlug(row.slug),
    ...row,
    name: row.name ?? row.display_name,
  })) as CanonicalSkill[];
}
export async function getUnlockedSkillsForProfile(profileId: string) {
  const { data } = await supabase
    .from("skill_progress")
    .select("skill_slug,current_level")
    .eq("profile_id", profileId);
  return (data ?? [])
    .filter((s: any) => (s.current_level ?? 0) > 0)
    .map((s: any) => s.skill_slug);
}
export async function getAvailableSkillsForProfile(profileId: string) {
  const { data } = await supabase
    .from("skill_progress")
    .select("skill_slug,current_level")
    .eq("profile_id", profileId);
  const progress = Object.fromEntries(
    (data ?? []).map((s: any) => [s.skill_slug, s.current_level ?? 0]),
  );
  return CANONICAL_SKILLS.map((s) => getAvailabilityForSkill(progress, s.slug));
}
export const KNOWN_ATTRIBUTE_KEYS = FULL_ATTRIBUTE_KEYS;
