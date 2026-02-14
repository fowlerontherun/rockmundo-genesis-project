import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
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

export function useDjPerformance() {
  const { user } = useAuth();
  const { settings } = useBehaviorSettings();
  const queryClient = useQueryClient();

  const performDjSet = useMutation({
    mutationFn: async (club: CityNightClub): Promise<DjPerformanceOutcome> => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!settings) throw new Error("Behavior settings not loaded");

      // 1. Get player profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, energy, cash, fame")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Get player attributes
      const { data: attrs } = await supabase
        .from("player_attributes")
        .select("stage_presence, charisma")
        .eq("user_id", user.id)
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

      // 2. Get DJ skill progress
      const { data: skillProgress } = await supabase
        .from("skill_progress")
        .select("*")
        .eq("profile_id", profile.id)
        .like("skill_slug", "dj_%");

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
          .eq("user_id", user.id)
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
            user_id: user.id,
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
        .eq("user_id", user.id);

      // 6. Award XP to DJ skills (spread across core skills)
      const djCoreSlugs = [
        "dj_basic_beatmatching",
        "dj_basic_mixing",
        "dj_basic_crowd_reading",
        "dj_basic_set_building",
      ];
      const xpPerSkill = Math.round(djOutcome.xpGained / djCoreSlugs.length);

      for (const slug of djCoreSlugs) {
        const existing = (skillProgress ?? []).find((s) => s.skill_slug === slug);
        if (existing) {
          await supabase
            .from("skill_progress")
            .update({
              current_xp: (existing.current_xp ?? 0) + xpPerSkill,
              last_practiced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("skill_progress").insert({
            profile_id: profile.id,
            skill_slug: slug,
            current_level: 0,
            current_xp: xpPerSkill,
            required_xp: 100,
            last_practiced_at: new Date().toISOString(),
          });
        }
      }

      // 7. Record performance
      await supabase.from("player_dj_performances").insert({
        user_id: user.id,
        profile_id: profile.id,
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
      queryKey: ["dj-performances", clubId],
      queryFn: async () => {
        if (!user?.id || !clubId) return [];
        const { data } = await supabase
          .from("player_dj_performances")
          .select("*")
          .eq("user_id", user.id)
          .eq("club_id", clubId)
          .order("created_at", { ascending: false })
          .limit(5);
        return data ?? [];
      },
      enabled: !!user?.id && !!clubId,
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
