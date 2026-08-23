import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAddictionTypeLabel, type AddictionType } from "@/utils/addictionSystem";
import type { NightlifeStance, NightlifeOutcomeDetail } from "@/utils/nightlifeRiskLayer";

export type NightlifeActivityType =
  | "guest_visit"
  | "dj_slot"
  | "bar_crawl"
  | "vip_clubbing"
  | "afterparty"
  | "stance_night";

export interface NightclubPolicySnapshot {
  profileId: string;
  cityId: string;
  nightclubId: string;
  cityLawId?: string | null;
  playerAge: number;
  alcoholLegalAge: number;
  alcoholAccess: boolean;
  drugPolicy: "strict" | "moderate" | "lenient";
}

interface NightlifeOutcome extends NightclubPolicySnapshot {
  fameGain: number;
  energyCost: number;
  energyGain?: number;
  cashSpent: number;
  addictionTriggered: boolean;
  addictionType?: AddictionType;
  addictionSeverityGain?: number;
  message: string;
  outcomeDetail?: NightlifeOutcomeDetail;
}

const pendingKeys = new Map<string, string>();
const getPendingKey = (key: string) => {
  const existing = pendingKeys.get(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  pendingKeys.set(key, created);
  return created;
};

const invokeNightclubSession = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("nightclub-session", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
};

const resolveClubId = async (clubId: string | undefined, clubName: string) => {
  if (clubId) return clubId;
  const { data, error } = await supabase
    .from("city_night_clubs")
    .select("id")
    .eq("name", clubName)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Nightclub is required");
  return data.id;
};

const LEGACY_ACTIVITY_STANCE: Partial<Record<NightlifeActivityType, NightlifeStance>> = {
  guest_visit: "stay_sober",
  bar_crawl: "party_hard",
  vip_clubbing: "network",
  afterparty: "party_hard",
};

export const fetchNightclubPolicy = (clubId: string) =>
  invokeNightclubSession<NightclubPolicySnapshot>({ clubId, actionType: "policy" });

export const buyAuthoritativeNightclubDrink = async (clubId: string, drinkId: string) => {
  const retryKey = `drink:${clubId}:${drinkId}`;
  const idempotencyKey = getPendingKey(retryKey);
  try {
    const result = await invokeNightclubSession<NightlifeOutcome>({
      clubId,
      actionType: "drink",
      drinkId,
      idempotencyKey,
    });
    pendingKeys.delete(retryKey);
    return result;
  } catch (error) {
    // Keep the key for an uncertain retry. The database returns the immutable
    // first result if the previous request committed before the connection failed.
    throw error;
  }
};

export function useNightlifeEvents() {
  const queryClient = useQueryClient();
  const [lastOutcomeDetail, setLastOutcomeDetail] = useState<NightlifeOutcomeDetail | null>(null);
  const [lastAddictionWarning, setLastAddictionWarning] = useState<string | null>(null);

  const nightlifeEventMutation = useMutation({
    mutationFn: async ({ activityType, clubName, clubId, stance }: {
      activityType: NightlifeActivityType;
      clubName: string;
      clubId?: string;
      stance?: NightlifeStance;
      venueQuality?: number;
    }): Promise<NightlifeOutcome> => {
      if (activityType === "dj_slot") {
        throw new Error("DJ sets use the dedicated DJ performance flow");
      }
      const authoritativeClubId = await resolveClubId(clubId, clubName);
      const authoritativeStance = activityType === "stance_night" ? stance : LEGACY_ACTIVITY_STANCE[activityType];
      if (!authoritativeStance) throw new Error("Nightlife stance is required");

      const retryKey = `stance:${authoritativeClubId}:${authoritativeStance}`;
      const idempotencyKey = getPendingKey(retryKey);
      const result = await invokeNightclubSession<NightlifeOutcome>({
        clubId: authoritativeClubId,
        actionType: "stance",
        stance: authoritativeStance,
        idempotencyKey,
      });
      pendingKeys.delete(retryKey);
      return result;
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
      queryClient.invalidateQueries({ queryKey: ["nightclub-policy"] });

      if (outcome.outcomeDetail) {
        setLastOutcomeDetail(outcome.outcomeDetail);
        if (outcome.addictionTriggered && outcome.addictionType) {
          setLastAddictionWarning(
            `${getAddictionTypeLabel(outcome.addictionType)} addiction ${outcome.addictionSeverityGain && outcome.addictionSeverityGain >= 20 ? "triggered" : `worsened (+${outcome.addictionSeverityGain ?? 0})`}!`,
          );
        } else {
          setLastAddictionWarning(null);
        }
      } else if (outcome.addictionTriggered) {
        toast.warning(outcome.message, { duration: 6000 });
      } else {
        toast.success(outcome.message);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dismissOutcome = () => {
    setLastOutcomeDetail(null);
    setLastAddictionWarning(null);
  };

  return {
    triggerNightlifeEvent: nightlifeEventMutation.mutate,
    isProcessing: nightlifeEventMutation.isPending,
    lastOutcome: nightlifeEventMutation.data,
    lastOutcomeDetail,
    lastAddictionWarning,
    dismissOutcome,
  };
}
