import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { CasinoGameType } from "@/lib/casino/types";

export function useCasino() {
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
      if (!profileId) throw new Error("Not authenticated");

      // The server resolves the balance change, records the transaction and
      // rolls addiction risk atomically. The browser never writes cash.
      const { data, error } = await (supabase as any).rpc("play_casino_round", {
        p_game_type: gameType,
        p_bet_amount: betAmount,
        p_payout: payout,
        p_metadata: metadata ?? {},
      });
      if (error) {
        if (error.message?.includes("insufficient_funds")) throw new Error("Insufficient funds");
        throw new Error(error.message ?? "Casino round failed");
      }

      if (data?.developedAddiction) {
        toast.warning("You're developing a gambling habit...", { description: "Be careful at the casino." });
      }

      return {
        netResult: Number(data?.netResult ?? 0),
        newCash: Number(data?.newCash ?? 0),
      };
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
