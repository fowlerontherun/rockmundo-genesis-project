import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SKILL_TREE_DEFINITIONS, SKILL_TREE_RELATIONSHIPS } from "@/data/skillTree";
import { isTierUnlocked, getPrerequisiteSlug, TIER_UNLOCK_LEVEL } from "@/data/skillTierGating";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useGameData } from "@/hooks/useGameData";

import { SkillSystemContext } from "./SkillSystemContext";
import {
  type SkillDefinitionRecord,
  type SkillProgressRecord,
  type SkillRelationshipRecord,
  type SkillSystemContextValue,
  type UpdateSkillProgressInput,
} from "./useSkillSystem.types";

const isObsoleteDjSlug = (slug: string) =>
  slug.startsWith("dj_basic_") ||
  slug.startsWith("dj_professional_") ||
  slug.startsWith("dj_mastery_");

const CANONICAL_DJ_DEFINITIONS: readonly SkillDefinitionRecord[] = [
  {
    id: "basic_dj_controller",
    slug: "basic_dj_controller",
    display_name: "Basic DJ Controller Skills",
    description: "Learn controller setup, beatmatching, transitions, cueing and crowd-aware set building.",
    icon_slug: "turntable",
    base_xp_gain: 6,
    training_duration_minutes: 30,
    metadata: { category: "DJ & Club Performance", tier: "Basic", track: "DJing" },
  },
  {
    id: "professional_djing",
    slug: "professional_djing",
    display_name: "Professional DJing",
    description: "Build polished club sets with advanced transitions, pacing and live crowd control.",
    icon_slug: "turntable",
    base_xp_gain: 10,
    training_duration_minutes: 45,
    metadata: { category: "DJ & Club Performance", tier: "Professional", track: "DJing" },
  },
  {
    id: "dj_mastery",
    slug: "dj_mastery",
    display_name: "DJ Mastery",
    description: "Deliver headline-level DJ performances with seamless technical and creative control.",
    icon_slug: "turntable",
    base_xp_gain: 14,
    training_duration_minutes: 60,
    metadata: { category: "DJ & Club Performance", tier: "Mastery", track: "DJing" },
  },
  {
    id: "basic_sampling_remixing",
    slug: "basic_sampling_remixing",
    display_name: "Basic Sampling & Remixing",
    description: "Learn sampling, chopping and remix fundamentals for electronic and DJ performance.",
    icon_slug: "controller",
    base_xp_gain: 6,
    training_duration_minutes: 30,
    metadata: { category: "DJ & Club Performance", tier: "Basic", track: "Sampling & Remixing" },
  },
  {
    id: "professional_sampling_remixing",
    slug: "professional_sampling_remixing",
    display_name: "Professional Sampling & Remixing",
    description: "Create polished edits, remixes and live-ready sample workflows.",
    icon_slug: "controller",
    base_xp_gain: 10,
    training_duration_minutes: 45,
    metadata: { category: "DJ & Club Performance", tier: "Professional", track: "Sampling & Remixing" },
  },
  {
    id: "sampling_remixing_mastery",
    slug: "sampling_remixing_mastery",
    display_name: "Sampling & Remixing Mastery",
    description: "Transform source material into distinctive, performance-ready remixes and edits.",
    icon_slug: "controller",
    base_xp_gain: 14,
    training_duration_minutes: 60,
    metadata: { category: "DJ & Club Performance", tier: "Mastery", track: "Sampling & Remixing" },
  },
] as const;

const CANONICAL_DJ_RELATIONSHIPS: readonly SkillRelationshipRecord[] = [
  {
    id: "professional_djing__basic_dj_controller",
    skill_slug: "professional_djing",
    required_skill_slug: "basic_dj_controller",
    required_value: 20,
    metadata: { category: "DJ & Club Performance", type: "tier_prerequisite", tier: "Professional" },
  },
  {
    id: "dj_mastery__professional_djing",
    skill_slug: "dj_mastery",
    required_skill_slug: "professional_djing",
    required_value: 20,
    metadata: { category: "DJ & Club Performance", type: "tier_prerequisite", tier: "Mastery" },
  },
  {
    id: "professional_sampling_remixing__basic_sampling_remixing",
    skill_slug: "professional_sampling_remixing",
    required_skill_slug: "basic_sampling_remixing",
    required_value: 20,
    metadata: { category: "DJ & Club Performance", type: "tier_prerequisite", tier: "Professional" },
  },
  {
    id: "sampling_remixing_mastery__professional_sampling_remixing",
    skill_slug: "sampling_remixing_mastery",
    required_skill_slug: "professional_sampling_remixing",
    required_value: 20,
    metadata: { category: "DJ & Club Performance", type: "tier_prerequisite", tier: "Mastery" },
  },
] as const;

const staticDefinitions = SKILL_TREE_DEFINITIONS.filter((definition) => !isObsoleteDjSlug(definition.slug));
const canonicalDjSlugs = new Set(CANONICAL_DJ_DEFINITIONS.map((definition) => definition.slug));
const SKILL_DEFINITIONS: readonly SkillDefinitionRecord[] = [
  ...staticDefinitions.filter((definition) => !canonicalDjSlugs.has(definition.slug)),
  ...CANONICAL_DJ_DEFINITIONS,
];

const staticRelationships = SKILL_TREE_RELATIONSHIPS.filter(
  (relationship) =>
    !isObsoleteDjSlug(relationship.skill_slug) &&
    !isObsoleteDjSlug(relationship.required_skill_slug) &&
    !canonicalDjSlugs.has(relationship.skill_slug),
);
const SKILL_RELATIONSHIPS: readonly SkillRelationshipRecord[] = [
  ...staticRelationships,
  ...CANONICAL_DJ_RELATIONSHIPS,
];

const DJ_PREREQUISITES: Readonly<Record<string, string>> = {
  professional_djing: "basic_dj_controller",
  dj_mastery: "professional_djing",
  professional_sampling_remixing: "basic_sampling_remixing",
  sampling_remixing_mastery: "professional_sampling_remixing",
};

type SkillProgressTable = Database["public"]["Tables"]["skill_progress"];
type SkillProgressRow = SkillProgressTable["Row"];
type SkillProgressInsert = SkillProgressTable["Insert"];

const mapProgressRow = (row: SkillProgressRow): SkillProgressRecord => ({
  id: row.id,
  profile_id: row.profile_id,
  skill_slug: row.skill_slug,
  current_level: row.current_level ?? null,
  current_xp: row.current_xp ?? null,
  required_xp: row.required_xp ?? null,
  last_practiced_at: row.last_practiced_at ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  metadata: (row.metadata as Record<string, unknown> | null) ?? null,
});

const isCanonicalDjTierUnlocked = (skillSlug: string, progress: SkillProgressRecord[]) => {
  const prerequisite = DJ_PREREQUISITES[skillSlug];
  if (!prerequisite) return true;
  const prerequisiteProgress = progress.find((record) => record.skill_slug === prerequisite);
  return Number(prerequisiteProgress?.current_level ?? 0) >= 20;
};

export const SkillSystemProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { profile } = useGameData();
  const [progress, setProgress] = useState<SkillProgressRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const definitions = useMemo(() => [...SKILL_DEFINITIONS], []);
  const relationships = useMemo(() => [...SKILL_RELATIONSHIPS], []);

  const refreshProgress = useCallback(async () => {
    if (!profile) {
      setProgress([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("skill_progress")
      .select("*")
      .eq("profile_id", profile.id);

    if (queryError) {
      console.error("Failed to load skill progress", queryError);
      setError(queryError.message);
      setProgress([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as SkillProgressRow[];
    setProgress(rows.map(mapProgressRow));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  const updateSkillProgress = useCallback(
    async (input: UpdateSkillProgressInput) => {
      if (!profile) {
        const message = "No active profile selected";
        setError(message);
        return null;
      }

      // Tier gating: refuse XP for higher tiers until the prerequisite is maxed.
      const canonicalDjUnlocked = isCanonicalDjTierUnlocked(input.skillSlug, progress);
      if (!canonicalDjUnlocked || !isTierUnlocked(input.skillSlug, progress)) {
        const prereq = DJ_PREREQUISITES[input.skillSlug] ?? getPrerequisiteSlug(input.skillSlug);
        const message = `Locked — reach level ${TIER_UNLOCK_LEVEL} in ${prereq ?? "the prerequisite skill"} first.`;
        toast.error("Skill tier locked", { description: message });
        setError(message);
        return null;
      }

      setError(null);

      const existing = progress.find((record) => record.skill_slug === input.skillSlug);
      const nextLevel = input.newSkillValue ?? existing?.current_level ?? 0;
      const nextXp = (existing?.current_xp ?? 0) + input.xpGain;
      const lastPracticedAt = input.timestamp ?? new Date().toISOString();

      const metadata = {
        ...(existing?.metadata as Record<string, unknown> ?? {}),
        ...(input.markUnlocked ? { unlocked: true } : {}),
        last_update_source: "skill_system_provider",
      } as Record<string, unknown>;

      const payload: SkillProgressInsert = {
        profile_id: profile.id,
        skill_slug: input.skillSlug,
        current_level: nextLevel,
        current_xp: nextXp,
        required_xp: existing?.required_xp ?? null,
        last_practiced_at: lastPracticedAt,
        metadata: metadata as SkillProgressInsert["metadata"],
      };

      const { data, error: upsertError } = await supabase
        .from("skill_progress")
        .upsert(payload as any, { onConflict: "profile_id,skill_slug" })
        .select("*")
        .maybeSingle();

      if (upsertError) {
        console.error("Failed to update skill progress", upsertError);
        setError(upsertError.message);
        return null;
      }

      const mapped = mapProgressRow((data ?? payload) as SkillProgressRow);
      setProgress((current) => {
        const filtered = current.filter((record) => record.skill_slug !== mapped.skill_slug);
        return [...filtered, mapped];
      });

      return mapped;
    },
    [profile, progress],
  );

  const value = useMemo<SkillSystemContextValue>(
    () => ({
      definitions,
      relationships,
      progress,
      loading,
      error,
      refreshProgress,
      updateSkillProgress,
    }),
    [definitions, relationships, progress, loading, error, refreshProgress, updateSkillProgress],
  );

  return <SkillSystemContext.Provider value={value}>{children}</SkillSystemContext.Provider>;
};
