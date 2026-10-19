import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { CasinoGameType } from "@/lib/casino/types";

export interface CasinoReceipt {
  roundId: string;
  netResult: number;
  newCash: number;
  payout: number;
  outcome: Record<string, unknown>;
  alreadyCompleted: boolean;
}

type ServerCasinoGame = Exclude<CasinoGameType, "blackjack">;

export function useCasino() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile-cash", profileId],
    queryFn: async () => {
      if (!profileId) return { cash: 0 };
      const { data, error } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (error) throw error;
      return data ?? { cash: 0 };
    },
    enabled: !!profileId,
  });

  const mutation = useMutation({
    mutationFn: async ({
      gameType, betAmount, choices, requestId,
    }: {
      gameType: ServerCasinoGame;
      betAmount: number;
      choices: Record<string, unknown>;
      requestId: string;
    }): Promise<CasinoReceipt> => {
      if (!profileId) throw new Error("Select an active character to play.");
      if (!requestId) throw new Error("Casino request ID required.");

      // NEVER pass a chosen payout, reel result or roulette wheel result.
      // A per-round idempotency UUID is reused after ambiguous network errors.
      const { data, error } = await (supabase as any).rpc(
        "play_casino_round_authoritative",
        {
          p_game_type: gameType,
          p_bet_amount: betAmount,
          p_choices: choices,
          p_request_id: requestId,
        },
      );
      if (error) {
        if (error.message?.includes("insufficient_funds")) throw new Error("Insufficient funds");
        throw new Error(error.message ?? "Casino round could not be confirmed.");
      }
      if (
        typeof data?.roundId !== "string" ||
        data?.netResult == null || data?.newCash == null || data?.payout == null ||
        !Number.isFinite(Number(data.netResult)) ||
        !Number.isFinite(Number(data.newCash)) ||
        !Number.isFinite(Number(data.payout)) ||
        !data?.outcome || typeof data.outcome !== "object" ||
        Array.isArray(data.outcome)
      ) {
        throw new Error("Casino settlement receipt missing or invalid. Retry with the same request ID.");
      }
      if (data.developedAddiction) {
        toast.warning("You're developing a gambling habit...", {
          description: "Be careful at the casino.",
        });
      }
      return {
        roundId: data.roundId,
        netResult: Number(data.netResult),
        newCash: Number(data.newCash),
        payout: Number(data.payout),
        outcome: data.outcome as Record<string, unknown>,
        alreadyCompleted: Boolean(data.alreadyCompleted),
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
    (gameType: ServerCasinoGame, betAmount: number, choices: Record<string, unknown>, requestId: string) =>
      mutation.mutateAsync({ gameType, betAmount, choices, requestId }),
    [mutation],
  );

  return {
    cash: profile?.cash ?? 0,
    recordTransaction,
    isRecording: mutation.isPending,
  };
}
