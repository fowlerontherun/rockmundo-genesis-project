import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";

import { SKILL_TREE_DEFINITIONS, SKILL_TREE_RELATIONSHIPS } from "@/data/skillTree";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useGameData } from "@/hooks/useGameDataSimplified";

import { SkillSystemContext } from "./SkillSystemContext";
import {
  type SkillDefinitionRecord,
  type SkillProgressRecord,
  type SkillRelationshipRecord,
  type SkillSystemContextValue,
  type UpdateSkillProgressInput,
} from "./useSkillSystem.types";

const SKILL_DEFINITIONS: readonly SkillDefinitionRecord[] = SKILL_TREE_DEFINITIONS;
const SKILL_RELATIONSHIPS: readonly SkillRelationshipRecord[] = SKILL_TREE_RELATIONSHIPS;

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
        .upsert(payload, { onConflict: "profile_id,skill_slug" })
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
