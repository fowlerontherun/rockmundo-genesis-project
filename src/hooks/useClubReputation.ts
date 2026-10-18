import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface ClubReputation {
  id: string;
  profile_id: string;
  club_id: string;
  visit_count: number;
  dj_sets_played: number;
  total_spend: number;
  reputation_tier: "newcomer" | "regular" | "vip" | "legend";
  reputation_points: number;
  perks_unlocked: string[];
  last_visit_at: string | null;
}

const TIER_PERKS: Record<string, string[]> = {
  newcomer: [],
  regular: ["Skip cover charge", "10% drink discount"],
  vip: ["Skip cover charge", "25% drink discount", "VIP lounge access", "Priority DJ slots"],
  legend: ["Skip cover charge", "50% drink discount", "VIP lounge access", "Priority DJ slots", "Backstage access", "Fame bonus +10%"],
};

export function getTierLabel(tier: ClubReputation["reputation_tier"]): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function getTierColor(tier: ClubReputation["reputation_tier"]): string {
  switch (tier) {
    case "legend": return "text-yellow-400";
    case "vip": return "text-purple-400";
    case "regular": return "text-blue-400";
    default: return "text-muted-foreground";
  }
}

export function getTierPerks(tier: ClubReputation["reputation_tier"]): string[] {
  return TIER_PERKS[tier] ?? [];
}

export function useClubReputation(clubId: string | undefined) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["club-reputation", profileId, clubId],
    queryFn: async () => {
      if (!profileId || !clubId) return null;
      const { data, error } = await supabase
        .from("player_club_reputation")
        .select("*")
        .eq("profile_id", profileId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ClubReputation | null;
    },
    enabled: !!profileId && !!clubId,
  });
}

export function useAllClubReputations() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["club-reputations", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_club_reputation")
        .select("*")
        .eq("profile_id", profileId);
      if (error) throw error;
      return (data ?? []) as unknown as ClubReputation[];
    },
    enabled: !!profileId,
  });
}

interface VerifiedClubVisitResult {
  awarded: boolean;
  tier: ClubReputation["reputation_tier"];
  previous_tier: ClubReputation["reputation_tier"];
  next_eligible_at: string;
}

/**
 * The server validates ownership, current city and an eight-hour cooldown.
 * Browser callers cannot nominate DJ set counts, claimed spend or VIP tiers.
 */
export function useRecordClubVisit() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId }: { clubId: string }): Promise<VerifiedClubVisitResult> => {
      if (!profileId) throw new Error("An active character is required");
      // Generated API types will include this after the migration type sync.
      const { data, error } = await supabase.rpc("record_verified_club_visit" as any, {
        p_profile_id: profileId,
        p_club_id: clubId,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || !("awarded" in data)) {
        throw new Error("Club visit was not acknowledged");
      }
      return data as unknown as VerifiedClubVisitResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["club-reputation"] });
      queryClient.invalidateQueries({ queryKey: ["club-reputations"] });
      if (result.awarded && result.tier !== result.previous_tier) {
        toast.success(`🎖️ Club reputation upgraded to ${getTierLabel(result.tier)}!`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to record club visit");
    },
  });
}
