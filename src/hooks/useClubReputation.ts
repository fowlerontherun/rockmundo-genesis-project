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

const TIER_THRESHOLDS = {
  regular: 5,   // 5 visits
  vip: 20,      // 20 visits
  legend: 50,   // 50 visits
};

function calculateTier(visitCount: number, djSets: number): ClubReputation["reputation_tier"] {
  const total = visitCount + djSets * 2;
  if (total >= TIER_THRESHOLDS.legend) return "legend";
  if (total >= TIER_THRESHOLDS.vip) return "vip";
  if (total >= TIER_THRESHOLDS.regular) return "regular";
  return "newcomer";
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

export function useRecordClubVisit() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clubId, cashSpent = 0, isDjSet = false }: { clubId: string; cashSpent?: number; isDjSet?: boolean }) => {
      if (!profileId) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("player_club_reputation")
        .select("*")
        .eq("profile_id", profileId)
        .eq("club_id", clubId)
        .maybeSingle();

      if (existing) {
        const rep = existing as any;
        const newVisitCount = (rep.visit_count || 0) + 1;
        const newDjSets = (rep.dj_sets_played || 0) + (isDjSet ? 1 : 0);
        const newSpend = (rep.total_spend || 0) + cashSpent;
        const newTier = calculateTier(newVisitCount, newDjSets);
        const newPoints = newVisitCount * 10 + newDjSets * 25 + Math.floor(newSpend / 10);

        const { error } = await supabase
          .from("player_club_reputation")
          .update({
            visit_count: newVisitCount,
            dj_sets_played: newDjSets,
            total_spend: newSpend,
            reputation_tier: newTier,
            reputation_points: newPoints,
            perks_unlocked: TIER_PERKS[newTier] ?? [],
            last_visit_at: new Date().toISOString(),
          })
          .eq("id", rep.id);
        if (error) throw error;

        // Notify tier upgrade
        if (newTier !== rep.reputation_tier) {
          toast.success(`🎖️ Club reputation upgraded to ${getTierLabel(newTier)}!`);
        }
      } else {
        const newTier = isDjSet ? "newcomer" : "newcomer";
        const { error } = await supabase
          .from("player_club_reputation")
          .insert({
            profile_id: profileId,
            club_id: clubId,
            visit_count: 1,
            dj_sets_played: isDjSet ? 1 : 0,
            total_spend: cashSpent,
            reputation_tier: newTier,
            reputation_points: 10 + (isDjSet ? 25 : 0) + Math.floor(cashSpent / 10),
            perks_unlocked: [],
            last_visit_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-reputation"] });
      queryClient.invalidateQueries({ queryKey: ["club-reputations"] });
    },
  });
}
