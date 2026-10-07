import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type PollVote = {
  id: string;
  poll_id: string;
  option_id: string;
  account_id: string;
};

export const useTwaaterPolls = (
  twaatId?: string,
  accountId?: string,
  preloadedPoll?: any,
  preloadedUserVote?: PollVote | null,
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: queriedPoll, isLoading: pollLoading } = useQuery({
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
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!twaatId && preloadedPoll === undefined,
  });

  const poll = preloadedPoll !== undefined ? preloadedPoll : queriedPoll;

  const { data: queriedUserVote } = useQuery({
    queryKey: ["poll-vote", poll?.id, accountId],
    queryFn: async () => {
      if (!poll?.id || !accountId) return null;

      const { data, error } = await supabase
        .from("twaater_poll_votes")
        .select("*")
        .eq("poll_id", poll.id)
        .eq("account_id", accountId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!poll?.id && !!accountId && preloadedUserVote === undefined,
  });

  const userVote = preloadedUserVote !== undefined ? preloadedUserVote : queriedUserVote;

  const voteMutation = useMutation({
    mutationFn: async ({ optionId }: { optionId: string }) => {
      if (!poll?.id || !accountId) throw new Error("No active Twaater account");
      if (new Date(poll.expires_at) <= new Date()) throw new Error("This poll has closed");

      const validOption = poll.options?.some((option: any) => option.id === optionId);
      if (!validOption) throw new Error("Invalid poll option");

      const { error } = await supabase
        .from("twaater_poll_votes")
        .insert({
          poll_id: poll.id,
          option_id: optionId,
          account_id: accountId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaat-poll", twaatId] });
      queryClient.invalidateQueries({ queryKey: ["poll-vote", poll?.id, accountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-poll-votes-batch", accountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-ai-feed"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-explore-feed"] });
      toast({ title: "Vote recorded", description: "Your vote has been counted." });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to vote",
        description: error?.message || "Could not record your vote.",
        variant: "destructive",
      });
    },
  });

  return {
    poll,
    userVote,
    isLoading: preloadedPoll === undefined ? pollLoading : false,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
  };
};
