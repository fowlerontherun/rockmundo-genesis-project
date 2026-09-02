import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterPolls = (twaatId?: string, accountId?: string) => {
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
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!twaatId,
  });

  const { data: userVote } = useQuery({
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
    enabled: !!poll?.id && !!accountId,
  });

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
    isLoading,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
  };
};
