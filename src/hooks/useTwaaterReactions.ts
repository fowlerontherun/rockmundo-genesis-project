import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterReactions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ twaatId, accountId }: { twaatId: string; accountId: string }) => {
      // Check if already liked
      const { data: existing } = await supabase
        .from("twaater_reactions")
        .select("id")
        .eq("twaat_id", twaatId)
        .eq("account_id", accountId)
        .eq("reaction_type", "like")
        .maybeSingle();

      if (existing) {
        // Unlike
        const { error } = await supabase
          .from("twaater_reactions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return { action: "unliked" };
      } else {
        // Like
        const { error } = await supabase
          .from("twaater_reactions")
          .insert({
            twaat_id: twaatId,
            account_id: accountId,
            reaction_type: "like",
          });

        if (error) throw error;
        return { action: "liked" };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRetwaatMutation = useMutation({
    mutationFn: async ({ twaatId, accountId }: { twaatId: string; accountId: string }) => {
      const { data: existing } = await supabase
        .from("twaater_reactions")
        .select("id")
        .eq("twaat_id", twaatId)
        .eq("account_id", accountId)
        .eq("reaction_type", "retwaat")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("twaater_reactions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
        return { action: "unretwaated" };
      } else {
        const { error } = await supabase
          .from("twaater_reactions")
          .insert({
            twaat_id: twaatId,
            account_id: accountId,
            reaction_type: "retwaat",
          });

        if (error) throw error;
        return { action: "retwaated" };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
    },
    onError: (error: any) => {
      toast({
        title: "Action failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    toggleLike: toggleLikeMutation.mutate,
    toggleRetwaat: toggleRetwaatMutation.mutate,
    isLiking: toggleLikeMutation.isPending,
    isRetwaating: toggleRetwaatMutation.isPending,
  };
};
