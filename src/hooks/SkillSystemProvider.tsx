import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

import { type PlayerSkills, useGameData } from "./useGameData";
import {
  type SkillDefinitionRecord,
  type SkillProgressRecord,
  type SkillRelationshipRecord,
  type SkillSystemContextValue,
  type UpdateSkillProgressInput
} from "./useSkillSystem.types";
import { SkillSystemContext } from "./SkillSystemContext";

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const safeMetadata = (value: unknown): Record<string, unknown> | undefined =>
  isObject(value) ? value : undefined;

const isMissingTableError = (error: PostgrestError | null | undefined) =>
  Boolean(
    error?.code === "42P01" ||
      error?.code === "PGRST201" ||
      error?.message?.toLowerCase().includes("does not exist")
  );

const isMissingColumnError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error || !column) {
    return false;
  }

  if (error.code !== "42703" && error.code !== "PGRST204") {
    return false;
  }

  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (haystacks.length === 0) {
    return false;
  }

  const target = column.toLowerCase();
  return haystacks.some(haystack => haystack.toLowerCase().includes(target));
};

interface RawSkillDefinitionRow {
  id?: string;
  slug?: string;
  display_name?: string | null;
  description?: string | null;
  icon_slug?: string | null;
  base_xp_gain?: number | null;
  training_duration_minutes?: number | null;
  tier_caps?: unknown;
  default_unlock_level?: number | null;
  metadata?: unknown;
  is_trainable?: boolean | null;
}

const mapSkillDefinition = (row: RawSkillDefinitionRow): SkillDefinitionRecord | null => {
  const slug = typeof row.slug === "string" && row.slug.trim().length > 0 ? row.slug.trim() : null;
  if (!slug) {
    return null;
  }

  const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : slug;

  const metadata: Record<string, unknown> = {};
  if (row.tier_caps !== undefined) {
    metadata.tier_caps = row.tier_caps;
  }
  if (typeof row.default_unlock_level === "number") {
    metadata.default_unlock_level = row.default_unlock_level;
  }
  if (isObject(row.metadata)) {
    Object.assign(metadata, row.metadata);
  }

  return {
    id,
    slug,
    display_name: row.display_name ?? undefined,
    description: row.description ?? undefined,
    icon_slug: typeof row.icon_slug === "string" ? row.icon_slug : undefined,
    base_xp_gain: typeof row.base_xp_gain === "number" ? row.base_xp_gain : undefined,
    training_duration_minutes:
      typeof row.training_duration_minutes === "number" ? row.training_duration_minutes : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    is_trainable: typeof row.is_trainable === "boolean" ? row.is_trainable : undefined
  } satisfies SkillDefinitionRecord;
};

interface RawSkillRelationshipRow {
  id?: string;
  skill_id?: string | null;
  related_skill_id?: string | null;
  relationship_type?: string | null;
  requirement_threshold?: number | null;
  metadata?: unknown;
}

const mapSkillRelationship = (
  row: RawSkillRelationshipRow,
  slugById: Map<string, string>
): SkillRelationshipRecord | null => {
  const skillId = typeof row.skill_id === "string" ? row.skill_id : null;
  const relatedSkillId = typeof row.related_skill_id === "string" ? row.related_skill_id : null;

  if (!skillId || !relatedSkillId) {
    return null;
  }

  const skillSlug = slugById.get(skillId);
  const requiredSkillSlug = slugById.get(relatedSkillId);

  if (!skillSlug || !requiredSkillSlug) {
    return null;
  }

  const metadata: Record<string, unknown> = {};
  if (row.relationship_type) {
    metadata.relationship_type = row.relationship_type;
  }
  if (isObject(row.metadata)) {
    Object.assign(metadata, row.metadata);
  }

  return {
    id: typeof row.id === "string" && row.id.trim().length > 0 ? row.id : `${skillSlug}-${requiredSkillSlug}`,
    skill_slug: skillSlug,
    required_skill_slug: requiredSkillSlug,
    required_value: typeof row.requirement_threshold === "number" ? row.requirement_threshold : 0,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  } satisfies SkillRelationshipRecord;
};

interface RawSkillProgressRow {
  id?: string;
  profile_id?: string | null;
  skill_id?: string | null;
  current_level?: number | null;
  current_value?: number | null;
  current_xp?: number | null;
  total_xp?: number | null;
  last_trained_at?: string | null;
  unlocked_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  tier?: number | null;
  progress_metadata?: unknown;
  skill?: { slug?: string | null } | null;
  skill_slug?: string | null;
}

const mapSkillProgress = (
  row: RawSkillProgressRow,
  slugById: Map<string, string>,
  defaultProfileId: string
): SkillProgressRecord | null => {
  const directSlug =
    (row.skill && typeof row.skill.slug === "string" ? row.skill.slug : null) ??
    (typeof row.skill_slug === "string" ? row.skill_slug : null);

  const slug = directSlug ?? (typeof row.skill_id === "string" ? slugById.get(row.skill_id) ?? null : null);

  if (!slug) {
    return null;
  }

  const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id : `${defaultProfileId}-${slug}`;
  const profileId =
    typeof row.profile_id === "string" && row.profile_id.trim().length > 0 ? row.profile_id : defaultProfileId;

  const metadataValue = safeMetadata(row.progress_metadata);
  const combinedMetadata: Record<string, unknown> = metadataValue ? { ...metadataValue } : {};

  if (typeof row.tier === "number") {
    combinedMetadata.tier = row.tier;
  }
  const normalizedLastTrainedAt =
    typeof row.last_trained_at === "string"
      ? row.last_trained_at
      : typeof row.updated_at === "string"
        ? row.updated_at
        : typeof row.created_at === "string"
          ? row.created_at
          : undefined;

  return {
    id,
    profile_id: profileId,
    skill_slug: slug,
    current_value: toNumber(row.current_value ?? row.current_level),
    total_xp: toNumber(row.total_xp ?? row.current_xp),
    last_trained_at: normalizedLastTrainedAt,
    unlocked_at: typeof row.unlocked_at === "string" ? row.unlocked_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
    metadata: Object.keys(combinedMetadata).length > 0 ? combinedMetadata : undefined
  } satisfies SkillProgressRecord;
};

export const SkillSystemProvider = ({ children }: { children: ReactNode }) => {
  const { selectedCharacterId, updateSkills } = useGameData();

  const [definitions, setDefinitions] = useState<SkillDefinitionRecord[]>([]);
  const [relationships, setRelationships] = useState<SkillRelationshipRecord[]>([]);
  const [progress, setProgress] = useState<SkillProgressRecord[]>([]);
  const [staticLoading, setStaticLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadStaticData = async () => {
      setStaticLoading(true);
      setError(null);
      try {
        const [definitionsResponse, relationshipsResponse] = await Promise.all([
          supabase.from("skill_definitions").select("*").order("display_name", { ascending: true }),
          supabase.from("skill_relationships").select("*")
        ]);

        if (!isMounted) {
          return;
        }

        let nextDefinitions: SkillDefinitionRecord[] = [];

        if (definitionsResponse.error) {
          if (!isMissingTableError(definitionsResponse.error)) {
            throw definitionsResponse.error;
          }
        } else {
          nextDefinitions = (definitionsResponse.data ?? [])
            .map(row => mapSkillDefinition(row as RawSkillDefinitionRow))
            .filter((record): record is SkillDefinitionRecord => Boolean(record));
        }

        setDefinitions(nextDefinitions);

        if (relationshipsResponse.error) {
          if (!isMissingTableError(relationshipsResponse.error)) {
            throw relationshipsResponse.error;
          }
          setRelationships([]);
        } else {
          const slugById = new Map(nextDefinitions.map(definition => [definition.id, definition.slug] as const));
          const nextRelationships = (relationshipsResponse.data ?? [])
            .map(row => mapSkillRelationship(row as RawSkillRelationshipRow, slugById))
            .filter((record): record is SkillRelationshipRecord => Boolean(record));
          setRelationships(nextRelationships);
        }
      } catch (err) {
        console.error("Error loading skill system data:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load skill system data.");
          setDefinitions([]);
          setRelationships([]);
        }
      } finally {
        if (isMounted) {
          setStaticLoading(false);
        }
      }
    };

    void loadStaticData();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!selectedCharacterId) {
      setProgress([]);
      return;
    }

    setProgressLoading(true);
    setError(null);

    try {
      const progressResponse = await supabase
        .from("profile_skill_progress")
        .select(
          "id, profile_id, skill_id, current_level, current_xp, tier, progress_metadata, updated_at, created_at, skill:skill_definitions!profile_skill_progress_skill_id_fkey (slug)"
        )
        .eq("profile_id", selectedCharacterId);

      if (progressResponse.error) {
        if (progressResponse.status === 404 || isMissingTableError(progressResponse.error)) {
          setProgress([]);
          return;
        }

        throw progressResponse.error;
      }

      const slugById = new Map(definitions.map(definition => [definition.id, definition.slug] as const));

      const mappedProgress = (progressResponse.data ?? [])
        .map(row => mapSkillProgress(row as RawSkillProgressRow, slugById, selectedCharacterId))
        .filter((entry): entry is SkillProgressRecord => Boolean(entry));

      setProgress(mappedProgress);
    } catch (err) {
      console.error("Error fetching skill progress:", err);
      setError(err instanceof Error ? err.message : "Failed to load skill progress.");
      setProgress([]);
    } finally {
      setProgressLoading(false);
    }
  }, [definitions, selectedCharacterId]);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  const progressBySlug = useMemo(() => {
    return progress.reduce<Record<string, SkillProgressRecord>>((acc, entry) => {
      if (entry.skill_slug) {
        acc[entry.skill_slug] = entry;
      }
      return acc;
    }, {});
  }, [progress]);

  const updateSkillProgress = useCallback(
    async ({ skillSlug, newSkillValue, xpGain, timestamp, markUnlocked = false }: UpdateSkillProgressInput) => {
      if (!selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      if (!skillSlug) {
        throw new Error("A skill slug is required to update skill progress.");
      }

      const isoTimestamp = timestamp ?? new Date().toISOString();
      const previous = progressBySlug[skillSlug];
      const previousTotal = toNumber(previous?.total_xp);
      const nextTotal = xpGain > 0 ? previousTotal + xpGain : previousTotal;
      const unlockedAt = markUnlocked
        ? isoTimestamp
        : previous?.unlocked_at ?? (xpGain > 0 ? isoTimestamp : null);

      const payload = {
        profile_id: selectedCharacterId,
        skill_slug: skillSlug,
        current_value: newSkillValue,
        total_xp: nextTotal,
        last_trained_at: isoTimestamp,
        updated_at: isoTimestamp,
        unlocked_at: unlockedAt ?? previous?.unlocked_at ?? null
      } satisfies Partial<SkillProgressRecord> & { profile_id: string; skill_slug: string };

      // Note: skill_progress table not implemented yet
      console.log("Would update skill progress:", payload);

      const updatedProgress: SkillProgressRecord = {
        ...(previous ?? { id: `${selectedCharacterId}-${skillSlug}` }),
        ...payload
      };

      setProgress(prev => {
        const index = prev.findIndex(entry => entry.skill_slug === skillSlug);
        if (index === -1) {
          return [...prev, updatedProgress];
        }

        const next = [...prev];
        next[index] = { ...next[index], ...updatedProgress };
        return next;
      });

      try {
        await updateSkills({
          [skillSlug]: newSkillValue,
          updated_at: isoTimestamp
        } as Partial<PlayerSkills>);
      } catch (updateError) {
        if (!isMissingColumnError(updateError as PostgrestError, skillSlug)) {
          throw updateError;
        }
        console.warn(`Skill column "${skillSlug}" is not available in player_skills; skipping direct update.`);
      }

      return updatedProgress;
    },
    [progressBySlug, selectedCharacterId, updateSkills]
  );

  const value = useMemo<SkillSystemContextValue>(
    () => ({
      definitions,
      relationships,
      progress,
      loading: staticLoading || progressLoading,
      error,
      refreshProgress,
      updateSkillProgress
    }),
    [definitions, relationships, progress, staticLoading, progressLoading, error, refreshProgress, updateSkillProgress]
  );

  return <SkillSystemContext.Provider value={value}>{children}</SkillSystemContext.Provider>;
};
