// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

export type SideHustleProgressRow =
  Database["public"]["Tables"]["side_hustle_progress"]["Row"];
export type SideHustleProgressInsert =
  Database["public"]["Tables"]["side_hustle_progress"]["Insert"];
export type SideHustleProgressUpdate =
  Database["public"]["Tables"]["side_hustle_progress"]["Update"];
export type SideHustleMinigameAttemptInsert =
  Database["public"]["Tables"]["side_hustle_minigame_attempts"]["Insert"];

const BASE_XP_THRESHOLD = 120;
const XP_THRESHOLD_STEP = 45;

export const getNextLevelThreshold = (level: number): number => {
  if (level <= 1) {
    return BASE_XP_THRESHOLD;
  }

  return BASE_XP_THRESHOLD + (level - 1) * XP_THRESHOLD_STEP;
};

export const calculateProgressUpgrade = (
  level: number,
  experience: number,
  xpGained: number,
) => {
  let currentLevel = Math.max(level, 1);
  let currentExperience = Math.max(experience, 0) + Math.max(xpGained, 0);
  let levelsGained = 0;

  while (currentExperience >= getNextLevelThreshold(currentLevel)) {
    currentExperience -= getNextLevelThreshold(currentLevel);
    currentLevel += 1;
    levelsGained += 1;
  }

  return {
    level: currentLevel,
    experience: currentExperience,
    levelsGained,
  };
};

export const fetchSideHustleProgress = async (
  profileId: string,
): Promise<SideHustleProgressRow[]> => {
  const { data, error } = await supabase
    .from("side_hustle_progress")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load side hustle progress: ${error.message}`);
  }

  return data ?? [];
};

export const upsertSideHustleProgress = async (
  payload: SideHustleProgressInsert | SideHustleProgressUpdate,
): Promise<SideHustleProgressRow> => {
  const { data, error } = await supabase
    .from("side_hustle_progress")
    .upsert(payload, { onConflict: "profile_id,activity_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to persist progress: ${error.message}`);
  }

  return data;
};

export const recordMinigameAttempt = async (
  payload: SideHustleMinigameAttemptInsert,
) => {
  const { error } = await supabase
    .from("side_hustle_minigame_attempts")
    .insert(payload);

  if (error) {
    throw new Error(`Failed to record minigame attempt: ${error.message}`);
  }
};
