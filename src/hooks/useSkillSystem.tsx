import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { type PlayerSkills, useGameData } from "./useGameData";

export interface SkillDefinitionRecord {
  id: string;
  slug: string;
  display_name?: string | null;
  description?: string | null;
  icon_slug?: string | null;
  base_xp_gain?: number | null;
  training_duration_minutes?: number | null;
  metadata?: Record<string, unknown> | null;
  is_trainable?: boolean | null;
}

export interface SkillRelationshipRecord {
  id: string;
  skill_slug: string;
  required_skill_slug: string;
  required_value: number;
  metadata?: Record<string, unknown> | null;
}

export interface SkillProgressRecord {
  id: string;
  profile_id: string;
  skill_slug: string;
  current_value?: number | null;
  total_xp?: number | null;
  last_trained_at?: string | null;
  unlocked_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateSkillProgressInput {
  skillSlug: string;
  newSkillValue: number;
  xpGain: number;
  timestamp?: string;
  markUnlocked?: boolean;
}

interface SkillSystemContextValue {
  definitions: SkillDefinitionRecord[];
  relationships: SkillRelationshipRecord[];
  progress: SkillProgressRecord[];
  loading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
  updateSkillProgress: (input: UpdateSkillProgressInput) => Promise<SkillProgressRecord | null>;
}

const SkillSystemContext = createContext<SkillSystemContextValue | undefined>(undefined);

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
          supabase.from("skill_definitions").select("*").order("slug", { ascending: true }),
          supabase.from("skill_relationships").select("*")
        ]);

        if (!isMounted) return;

        if (definitionsResponse.error && definitionsResponse.status !== 406) {
          throw definitionsResponse.error;
        }
        if (relationshipsResponse.error && relationshipsResponse.status !== 406) {
          throw relationshipsResponse.error;
        }

        setDefinitions(definitionsResponse.data ?? []);
        setRelationships(relationshipsResponse.data ?? []);
      } catch (err) {
        console.error("Error loading skill system data:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load skill system data.");
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
      const { data, error: progressError, status } = await supabase
        .from("skill_progress")
        .select("*")
        .eq("profile_id", selectedCharacterId);

      if (progressError && status !== 406) {
        throw progressError;
      }

      setProgress(data ?? []);
    } catch (err) {
      console.error("Error fetching skill progress:", err);
      setError(err instanceof Error ? err.message : "Failed to load skill progress.");
      setProgress([]);
    } finally {
      setProgressLoading(false);
    }
  }, [selectedCharacterId]);

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

      const { data, error: upsertError } = await supabase
        .from("skill_progress")
        .upsert(payload, { onConflict: "profile_id,skill_slug" })
        .select()
        .maybeSingle();

      if (upsertError) {
        console.error("Error updating skill progress:", upsertError);
        throw upsertError;
      }

      const updatedProgress: SkillProgressRecord = {
        ...(previous ?? { id: data?.id ?? `${selectedCharacterId}-${skillSlug}` }),
        ...payload,
        ...(data ?? {})
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

      await updateSkills({
        [skillSlug]: newSkillValue,
        updated_at: isoTimestamp
      } as Partial<PlayerSkills>);

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

export const useSkillSystem = (): SkillSystemContextValue => {
  const context = useContext(SkillSystemContext);
  if (!context) {
    throw new Error("useSkillSystem must be used within a SkillSystemProvider");
  }
  return context;
};
