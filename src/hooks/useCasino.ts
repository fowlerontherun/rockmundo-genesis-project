import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { CasinoGameType } from "@/lib/casino/types";

export function useCasino() {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-cash", profileId],
    queryFn: async () => {
      if (!profileId) return { cash: 0 };
      const { data } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      return data ?? { cash: 0 };
    },
    enabled: !!profileId,
  });

  const mutation = useMutation({
    mutationFn: async ({
      gameType,
      betAmount,
      payout,
      metadata,
    }: {
      gameType: CasinoGameType;
      betAmount: number;
      payout: number;
      metadata: Record<string, unknown>;
    }) => {
      if (!user?.id || !profileId) throw new Error("Not authenticated");

      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      const currentCash = freshProfile?.cash ?? 0;
      if (currentCash < betAmount) throw new Error("Insufficient funds");

      const netResult = payout - betAmount;
      const newCash = currentCash + netResult;

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: Math.max(0, newCash) })
        .eq("id", profileId);
      if (cashError) throw cashError;

      await (supabase as any).from("casino_transactions").insert({
        profile_id: profileId,
        game_type: gameType,
        bet_amount: betAmount,
        payout,
        net_result: netResult,
        metadata,
      });

      // Gambling addiction roll (5% chance per bet)
      if (Math.random() < 0.05) {
        const { data: existing } = await (supabase as any)
          .from("player_addictions")
          .select("id, severity")
          .eq("profile_id", profileId)
          .eq("addiction_type", "gambling")
          .in("status", ["active", "recovering"])
          .maybeSingle();

        if (existing) {
          await (supabase as any)
            .from("player_addictions")
            .update({ severity: Math.min(100, existing.severity + 3), updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await (supabase as any).from("player_addictions").insert({
            user_id: user.id,
            profile_id: profileId,
            addiction_type: "gambling",
            severity: 10,
            status: "active",
            triggered_at: new Date().toISOString(),
            days_clean: 0,
            relapse_count: 0,
          });
          toast.warning("You're developing a gambling habit...", { description: "Be careful at the casino." });
        }
      }

      return { netResult, newCash };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-cash"] });
      queryClient.invalidateQueries({ queryKey: ["casino-stats"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const recordTransaction = useCallback(
    async (gameType: CasinoGameType, betAmount: number, payout: number, metadata: Record<string, unknown>) => {
      return mutation.mutateAsync({ gameType, betAmount, payout, metadata });
    },
    [mutation]
  );

  return {
    cash: profile?.cash ?? 0,
    recordTransaction,
    isRecording: mutation.isPending,
  };
}
