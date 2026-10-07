import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { invalidateTwaaterContentQueries } from "@/lib/twaaterQueryInvalidation";

type PostReplyInput = {
  twaatId: string;
  accountId: string;
  body: string;
};

export const useTwaaterReplyActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const postReplyMutation = useMutation({
    mutationFn: async ({ twaatId, accountId, body }: PostReplyInput) => {
      const { error } = await supabase
        .from("twaat_replies")
        .insert({
          parent_twaat_id: twaatId,
          account_id: accountId,
          body,
        });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["twaat-replies", variables.twaatId] });
      invalidateTwaaterContentQueries(queryClient);
      toast({
        title: "Reply posted",
        description: "Your reply is now visible.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reply",
        description: error?.message || "We couldn't post that reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    postReply: postReplyMutation.mutate,
    postReplyAsync: postReplyMutation.mutateAsync,
    isPosting: postReplyMutation.isPending,
  };
};

export const useTwaaterReplies = (twaatId: string, loadReplies = true) => {
  const { data: replies, isLoading } = useQuery({
    queryKey: ["twaat-replies", twaatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaat_replies")
        .select(`
          *,
          account:twaater_accounts!twaat_replies_account_id_fkey(id, handle, display_name, verified)
        `)
        .eq("parent_twaat_id", twaatId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: loadReplies && !!twaatId,
  });

  const replyActions = useTwaaterReplyActions();

  return {
    replies,
    isLoading,
    postReply: ({ accountId, body }: { accountId: string; body: string }) =>
      replyActions.postReply({ twaatId, accountId, body }),
    postReplyAsync: ({ accountId, body }: { accountId: string; body: string }) =>
      replyActions.postReplyAsync({ twaatId, accountId, body }),
    isPosting: replyActions.isPosting,
  };
};
