import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterPolls = (twaatId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: poll, isLoading } = useQuery({
    queryKey: ["twaat-poll", twaatId],
    queryFn: async () => {
      if (!twaatId) return null;

      const { data, error } = await supabase
        .from("twaater_polls")
        .select(`
          *,
          options:twaater_poll_options(*)
        `)
        .eq("twaat_id", twaatId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!twaatId,
  });

  const { data: userVote } = useQuery({
    queryKey: ["poll-vote", poll?.id],
    queryFn: async () => {
      if (!poll?.id) return null;

      const { data, error } = await supabase
        .from("twaater_poll_votes")
        .select("*")
        .eq("poll_id", poll.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!poll?.id,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ optionId }: { optionId: string }) => {
      if (!poll?.id) throw new Error("No poll ID");

      const { error } = await supabase
        .from("twaater_poll_votes")
        .insert({
          poll_id: poll.id,
          option_id: optionId,
          account_id: "", // Will be set by RLS
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaat-poll"] });
      queryClient.invalidateQueries({ queryKey: ["poll-vote"] });
      toast({
        title: "Vote recorded",
        description: "Your vote has been counted.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to vote",
        description: "Could not record your vote.",
        variant: "destructive",
      });
    },
  });

  return {
    poll,
    userVote,
    isLoading,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
  };
};