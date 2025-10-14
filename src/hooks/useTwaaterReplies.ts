import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterReplies = (twaatId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: replies, isLoading } = useQuery({
    queryKey: ["twaat-replies", twaatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaat_replies")
        .select(`
          *,
          account:twaater_accounts(id, handle, display_name, verified)
        `)
        .eq("parent_twaat_id", twaatId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const postReplyMutation = useMutation({
    mutationFn: async ({ accountId, body }: { accountId: string; body: string }) => {
      const { error } = await supabase
        .from("twaat_replies")
        .insert({
          parent_twaat_id: twaatId,
          account_id: accountId,
          body,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaat-replies", twaatId] });
      queryClient.invalidateQueries({ queryKey: ["twaats"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      toast({
        title: "Reply posted",
        description: "Your reply is now visible.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reply",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    replies,
    isLoading,
    postReply: postReplyMutation.mutate,
    isPosting: postReplyMutation.isPending,
  };
};
