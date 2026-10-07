import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { invalidateTwaaterContentQueries } from "@/lib/twaaterQueryInvalidation";

type ReactionType = "like" | "retwaat";

type ReactionRow = {
  id: string;
  twaat_id: string;
  reaction_type: ReactionType;
};

type ToggleReactionInput = {
  twaatId: string;
  accountId: string;
  reactionType: ReactionType;
  active: boolean;
};

export const useTwaaterReactions = (accountId?: string, twaatIds: string[] = []) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const stableTwaatIds = Array.from(new Set(twaatIds)).sort();

  const { data: reactions = [] } = useQuery({
    queryKey: ["twaater-reaction-state", accountId, stableTwaatIds],
    queryFn: async (): Promise<ReactionRow[]> => {
      if (!accountId || stableTwaatIds.length === 0) return [];

      const { data, error } = await supabase
        .from("twaater_reactions")
        .select("id, twaat_id, reaction_type")
        .eq("account_id", accountId)
        .in("twaat_id", stableTwaatIds)
        .in("reaction_type", ["like", "retwaat"]);

      if (error) throw error;
      return (data || []) as ReactionRow[];
    },
    enabled: !!accountId && stableTwaatIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const reactionSet = new Set(reactions.map((reaction) => `${reaction.twaat_id}:${reaction.reaction_type}`));

  const mutation = useMutation({
    mutationFn: async ({ twaatId, accountId, reactionType, active }: ToggleReactionInput) => {
      if (active) {
        const { error } = await supabase
          .from("twaater_reactions")
          .delete()
          .eq("twaat_id", twaatId)
          .eq("account_id", accountId)
          .eq("reaction_type", reactionType);
        if (error) throw error;
        return { twaatId, reactionType, active: false };
      }

      const { error } = await supabase
        .from("twaater_reactions")
        .insert({
          twaat_id: twaatId,
          account_id: accountId,
          reaction_type: reactionType,
        });
      if (error) throw error;
      return { twaatId, reactionType, active: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-reaction-state", accountId] });
      invalidateTwaaterContentQueries(queryClient);
    },
    onError: (error: any) => {
      toast({
        title: "Action failed",
        description: error?.message || "We couldn't update that reaction.",
        variant: "destructive",
      });
    },
  });

  const isLiked = (twaatId: string) => reactionSet.has(`${twaatId}:like`);
  const isRetwaated = (twaatId: string) => reactionSet.has(`${twaatId}:retwaat`);

  return {
    toggleLike: ({ twaatId, accountId: targetAccountId }: { twaatId: string; accountId: string }) =>
      mutation.mutate({
        twaatId,
        accountId: targetAccountId,
        reactionType: "like",
        active: isLiked(twaatId),
      }),
    toggleRetwaat: ({ twaatId, accountId: targetAccountId }: { twaatId: string; accountId: string }) =>
      mutation.mutate({
        twaatId,
        accountId: targetAccountId,
        reactionType: "retwaat",
        active: isRetwaated(twaatId),
      }),
    isLiked,
    isRetwaated,
    isReactionPending: mutation.isPending,
  };
};
