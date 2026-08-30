import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type GigAbsenceDecision = "perform" | "cancel";

interface ResolveGigAbsenceResult {
  decision?: GigAbsenceDecision;
  alreadyDecided?: boolean;
  absentMembers?: number;
  qualityPenalty?: number;
  fanLoss?: number;
  fameLoss?: number;
}

/**
 * Lets a band leader respond to the "members missing for the gig" alert:
 * perform without them (quality penalty) or pull the gig (fan/fame penalty).
 */
export function useGigAbsenceDecision() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ gigId, decision }: { gigId: string; decision: GigAbsenceDecision }) => {
      const { data, error } = await (supabase as any).rpc("resolve_gig_absence", {
        p_gig_id: gigId,
        p_decision: decision,
      });
      if (error) throw error;
      return (data ?? {}) as ResolveGigAbsenceResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gigs"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inbox"] });

      if (result.alreadyDecided) {
        toast({
          title: "Already decided",
          description: `This gig was already resolved (${result.decision}).`,
        });
        return;
      }

      if (result.decision === "perform") {
        const penalty = Math.round((result.qualityPenalty ?? 0) * 100);
        toast({
          title: "Show goes on",
          description: `Performing without ${result.absentMembers ?? 0} member(s). Expect roughly a ${penalty}% hit to performance quality.`,
        });
      } else {
        toast({
          title: "Gig pulled",
          description: `The show was cancelled. Lost ${result.fanLoss ?? 0} fans and ${result.fameLoss ?? 0} fame.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not save your decision.";
      toast({
        title: "Decision failed",
        description: message.includes("not_authorised")
          ? "Only the band leader can decide on this gig."
          : message,
        variant: "destructive",
      });
    },
  });
}
