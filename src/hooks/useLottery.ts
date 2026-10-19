import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { getUtcWeekStart, formatUtcDate } from "@/utils/week";
import { toast } from "@/hooks/use-toast";
import {
  LOTTERY_MAX_TICKETS_PER_DRAW as MAX_TICKETS_PER_DRAW,
  LOTTERY_TICKET_COST as TICKET_COST,
  lotterySelectionError,
} from "@/lib/lottery/rules";

export function useCurrentDraw() {
  const weekStart = formatUtcDate(getUtcWeekStart(new Date(), 1));

  return useQuery({
    queryKey: ["lottery-draw", weekStart],
    queryFn: async () => {
      // Try to get existing draw
      const { data, error } = await supabase
        .from("lottery_draws")
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;

      // Create pending draw for this week
      const { data: newDraw, error: createError } = await supabase
        .from("lottery_draws")
        .insert({ week_start: weekStart })
        .select()
        .single();

      if (createError) {
        // Another user might have created it concurrently
        const { data: retry } = await supabase
          .from("lottery_draws")
          .select("*")
          .eq("week_start", weekStart)
          .single();
        return retry;
      }
      return newDraw;
    },
  });
}

export function useMyTicketsForDraw(drawId: string | undefined) {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["lottery-tickets-draw", drawId, profileId],
    enabled: !!drawId && !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lottery_tickets")
        .select("*")
        .eq("draw_id", drawId!)
        .eq("profile_id", profileId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useMyTickets() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["lottery-tickets", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lottery_tickets")
        .select("*, lottery_draws(*)")
        .eq("profile_id", profileId!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
}

export function useBuyTicket() {
  const { profileId } = useActiveProfile();
  const { profile } = useGameData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      drawId,
      selectedNumbers,
      bonusNumber,
    }: {
      drawId: string;
      selectedNumbers: number[];
      bonusNumber: number;
    }) => {
      if (!profileId || !profile?.id) throw new Error("Not authenticated");
      if ((profile as any).cash < TICKET_COST) throw new Error("Not enough cash");
      const selectionError = lotterySelectionError(selectedNumbers, bonusNumber);
      if (selectionError) throw new Error(selectionError);

      const { data, error } = await (supabase as any).rpc("buy_lottery_ticket_atomic", {
        p_profile_id: profileId,
        p_draw_id: drawId,
        p_selected_numbers: selectedNumbers,
        p_bonus_number: bonusNumber,
      });
      if (error) throw error;
      if (!data?.id) throw new Error("Lottery purchase was not confirmed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lottery-tickets-draw"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      toast({ title: "Ticket purchased!", description: `$${TICKET_COST} deducted from your cash.` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to buy ticket", description: err.message, variant: "destructive" });
    },
  });
}

export function useDrawHistory() {
  return useQuery({
    queryKey: ["lottery-draw-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lottery_draws")
        .select("*")
        .in("status", ["drawn", "paid_out"])
        .order("week_start", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
}

export function useClaimPrize() {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      if (!profileId) throw new Error("Not authenticated");

      // Get ticket
      const { data: ticket, error: fetchError } = await supabase
        .from("lottery_tickets")
        .select("*, lottery_draws(*)")
        .eq("id", ticketId)
        .eq("profile_id", profileId)
        .single();

      if (fetchError) throw fetchError;
      if (!ticket) throw new Error("Ticket not found");
      if (ticket.claimed) throw new Error("Already claimed");
      if (ticket.prize_cash === 0 && ticket.prize_xp === 0 && ticket.prize_fame === 0)
        throw new Error("No prize to claim");

      const { data: settled, error: settlementError } = await (supabase as any)
        .rpc("claim_lottery_prize_atomic", { p_profile_id: profileId, p_ticket_id: ticketId });
      if (settlementError) throw settlementError;
      if (!settled?.claimed) throw new Error("Prize settlement was not confirmed");
      return settled as typeof ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["lottery-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["lottery-tickets-draw"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      const parts: string[] = [];
      if (ticket.prize_cash > 0) parts.push(`$${ticket.prize_cash.toLocaleString()}`);
      if (ticket.prize_xp > 0) parts.push(`${ticket.prize_xp} XP`);
      if (ticket.prize_fame > 0) parts.push(`${ticket.prize_fame} Fame`);
      toast({ title: "Prize claimed!", description: parts.join(" + ") });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to claim prize", description: err.message, variant: "destructive" });
    },
  });
}

export { TICKET_COST, MAX_TICKETS_PER_DRAW };
