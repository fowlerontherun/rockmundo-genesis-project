import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBehaviorSettings } from "@/hooks/useBehaviorSettings";
import { toast } from "sonner";
import {
  calculateDjPerformanceScore,
  generateDjOutcome,
  type DjOutcome,
} from "@/utils/djPerformance";
import {
  rollForAddiction,
  getAddictionTypeLabel,
  type AddictionType,
} from "@/utils/addictionSystem";
import type { CityNightClub } from "@/utils/worldEnvironment";

export interface DjPerformanceOutcome extends DjOutcome {
  addictionTriggered: boolean;
  addictionType?: AddictionType;
  addictionSeverityGain?: number;
  clubName: string;
}

const DJ_ENERGY_COST = 25;
const DJ_PROGRESSION_SLUGS = [
  "basic_dj_controller",
  "professional_djing",
  "dj_mastery",
] as const;
const DJ_RELEVANT_SLUGS = [
  ...DJ_PROGRESSION_SLUGS,
  "basic_sampling_remixing",
  "professional_sampling_remixing",
  "sampling_remixing_mastery",
] as const;

type SkillProgressLike = {
  id?: string;
  skill_slug: string;
  current_level?: number | null;
  current_xp?: number | null;
  required_xp?: number | null;
};

async function getSkillMaxLevel(skillSlug: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("progression_skill_max_level", {
    p_skill_slug: skillSlug,
  });
  if (error) throw error;
  const maxLevel = Number(data);
  return Number.isFinite(maxLevel) && maxLevel > 0 ? maxLevel : 20;
}

async function getRequiredSkillXp(level: number): Promise<number> {
  const { data, error } = await (supabase as any).rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  const required = Number(data);
  return Number.isFinite(required) && required > 0 ? required : 100;
}

async function awardCanonicalSkillXp(
  profileId: string,
  skillSlug: string,
  amount: number,
  existing?: SkillProgressLike,
) {
  if (amount <= 0) return;

  const maxLevel = await getSkillMaxLevel(skillSlug);
  let level = Math.min(Math.max(Number(existing?.current_level ?? 0), 0), maxLevel);
  let currentXp = Math.max(Number(existing?.current_xp ?? 0), 0);
  let requiredXp = Number(existing?.required_xp ?? 0);

  if (level >= maxLevel) return;
  if (requiredXp <= 0) requiredXp = await getRequiredSkillXp(level);

  currentXp += amount;
  while (level < maxLevel && currentXp >= requiredXp) {
    currentXp -= requiredXp;
    level += 1;
    requiredXp = level < maxLevel ? await getRequiredSkillXp(level) : 0;
  }

  if (level >= maxLevel) {
    level = maxLevel;
    currentXp = 0;
    requiredXp = 0;
  }

  const { error } = await (supabase as any).from("skill_progress").upsert(
    {
      profile_id: profileId,
      skill_slug: skillSlug,
      current_level: level,
      current_xp: currentXp,
      required_xp: requiredXp,
      last_practiced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,skill_slug" },
  );
  if (error) throw error;
}

async function chooseDjRewardSkill(progress: SkillProgressLike[]): Promise<string> {
  // Reward the highest DJ tier the player has actually started and can still
  // progress. Starting a DJ set must never auto-unlock an advanced tier.
  for (const slug of [...DJ_PROGRESSION_SLUGS].reverse()) {
    const row = progress.find((entry) => entry.skill_slug === slug);
    if (!row || Number(row.current_level ?? 0) <= 0) continue;
    const maxLevel = await getSkillMaxLevel(slug);
    if (Number(row.current_level ?? 0) < maxLevel) return slug;
  }

  return "basic_dj_controller";
}

export function useDjPerformance() {
  const { profileId } = useActiveProfile();
  const { settings } = useBehaviorSettings();
  const queryClient = useQueryClient();

  const performDjSet = useMutation({
    mutationFn: async (club: CityNightClub): Promise<DjPerformanceOutcome> => {
      if (!profileId) throw new Error("Not authenticated");
      if (!settings) throw new Error("Behavior settings not loaded");

      // 1. Get player profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, energy, cash, fame")
        .eq("id", profileId)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Get player attributes
      const { data: attrs } = await supabase
        .from("player_attributes")
        .select("stage_presence, charisma")
        .eq("profile_id", profileId)
        .maybeSingle();

      const energy = profile.energy ?? 100;
      const fame = profile.fame ?? 0;
      const fameReq = club.djSlot?.fameRequirement ?? 0;

      if (fame < fameReq) {
        throw new Error(`Need ${fameReq.toLocaleString()} fame to DJ here (you have ${fame.toLocaleString()})`);
      }
      if (energy < DJ_ENERGY_COST) {
        throw new Error(`Need ${DJ_ENERGY_COST} energy for a DJ set`);
      }

      // 2. Load the canonical DJ and sampling/remixing skill families.
      const { data: skillProgress, error: skillProgressError } = await supabase
        .from("skill_progress")
        .select("*")
        .eq("profile_id", profileId)
        .in("skill_slug", [...DJ_RELEVANT_SLUGS]);

      if (skillProgressError) throw skillProgressError;

      // 3. Calculate performance
      const perfResult = calculateDjPerformanceScore({
        skillProgress: (skillProgress ?? []) as any,
        stagePresence: attrs?.stage_presence ?? 0,
        charisma: attrs?.charisma ?? 0,
        clubQualityLevel: club.qualityLevel,
      });

      const clubPayout = club.djSlot?.payout ?? 200;
      const setLength = club.djSlot?.setLengthMinutes ?? 45;

      const djOutcome = generateDjOutcome(
        perfResult.score,
        perfResult.outcomeLabel,
        perfResult.outcomeDescription,
        clubPayout,
        club.qualityLevel,
        setLength
      );

      // 4. Addiction roll
      const { triggered, type: addictionType } = rollForAddiction(settings);
      let addictionTriggered = false;
      let addictionSeverityGain = 0;

      if (triggered) {
        addictionTriggered = true;
        const { data: existing } = await supabase
          .from("player_addictions")
          .select("*")
          .eq("profile_id", profileId)
          .eq("addiction_type", addictionType)
          .in("status", ["active", "recovering", "relapsed"])
          .maybeSingle();

        if (existing) {
          addictionSeverityGain = 5 + Math.floor(Math.random() * 6);
          const newSev = Math.min(100, existing.severity + addictionSeverityGain);
          await supabase
            .from("player_addictions")
            .update({ severity: newSev, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          addictionSeverityGain = 20;
          await supabase.from("player_addictions").insert({
            user_id: profileId,
            profile_id: profileId,
            addiction_type: addictionType,
            severity: 20,
            status: "active",
            triggered_at: new Date().toISOString(),
            days_clean: 0,
            relapse_count: 0,
          });
        }
      }

      // 5. Update profile (energy, cash, fame)
      await supabase
        .from("profiles")
        .update({
          energy: Math.max(0, energy - DJ_ENERGY_COST),
          cash: (profile.cash ?? 0) + djOutcome.cashEarned,
          fame: fame + djOutcome.fameGained,
        })
        .eq("id", profileId);

      // 6. Award the full DJ skill reward to the highest DJ tier the player
      // has already started. The canonical XP curve handles level-ups.
      const progressRows = (skillProgress ?? []) as SkillProgressLike[];
      const rewardSlug = await chooseDjRewardSkill(progressRows);
      const existingRewardSkill = progressRows.find((row) => row.skill_slug === rewardSlug);
      await awardCanonicalSkillXp(profileId, rewardSlug, djOutcome.xpGained, existingRewardSkill);

      // 7. Record performance
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from("player_dj_performances").insert({
        user_id: currentUser?.id ?? profileId,
        profile_id: profileId,
        club_id: club.id,
        performance_score: djOutcome.performanceScore,
        cash_earned: djOutcome.cashEarned,
        fame_gained: djOutcome.fameGained,
        fans_gained: djOutcome.fansGained,
        xp_gained: djOutcome.xpGained,
        outcome_text: djOutcome.outcomeLabel,
        set_length_minutes: setLength,
      });

      return {
        ...djOutcome,
        addictionTriggered,
        addictionType: addictionTriggered ? addictionType : undefined,
        addictionSeverityGain: addictionTriggered ? addictionSeverityGain : undefined,
        clubName: club.name,
      };
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
      queryClient.invalidateQueries({ queryKey: ["dj-performances"] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });

      if (outcome.addictionTriggered && outcome.addictionType) {
        toast.warning(
          `⚠️ ${getAddictionTypeLabel(outcome.addictionType)} addiction ${outcome.addictionSeverityGain === 20 ? "triggered" : `worsened (+${outcome.addictionSeverityGain})`}!`,
          { duration: 6000 }
        );
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Recent performances at a specific club
  const useClubPerformances = (clubId: string | undefined) =>
    useQuery({
      queryKey: ["dj-performances", profileId, clubId],
      queryFn: async () => {
        if (!profileId || !clubId) return [];
        const { data } = await supabase
          .from("player_dj_performances")
          .select("*")
          .eq("profile_id", profileId)
          .eq("club_id", clubId)
          .order("created_at", { ascending: false })
          .limit(5);
        return data ?? [];
      },
      enabled: !!profileId && !!clubId,
    });

  return {
    performDjSet: performDjSet.mutate,
    performDjSetAsync: performDjSet.mutateAsync,
    isPerforming: performDjSet.isPending,
    lastDjOutcome: performDjSet.data,
    resetOutcome: performDjSet.reset,
    useClubPerformances,
  };
}
