import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useTwaaterMessages = (accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["twaater-conversations", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("twaater_conversations")
        .select(`
          *,
          participant_1:twaater_accounts!participant_1_id(id, handle, display_name, verified),
          participant_2:twaater_accounts!participant_2_id(id, handle, display_name, verified)
        `)
        .or(`participant_1_id.eq.${accountId},participant_2_id.eq.${accountId}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const getOrCreateConversationMutation = useMutation({
    mutationFn: async ({ otherAccountId }: { otherAccountId: string }) => {
      if (!accountId) throw new Error("No account ID");

      const [lower, higher] = [accountId, otherAccountId].sort();

      // Check if conversation exists
      const { data: existing } = await supabase
        .from("twaater_conversations")
        .select("*")
        .eq("participant_1_id", lower)
        .eq("participant_2_id", higher)
        .single();

      if (existing) return existing;

      // Create new conversation
      const { data, error } = await supabase
        .from("twaater_conversations")
        .insert({
          participant_1_id: lower,
          participant_2_id: higher,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-conversations"] });
    },
  });

  return {
    conversations,
    isLoading,
    getOrCreateConversation: getOrCreateConversationMutation.mutateAsync,
  };
};

export const useTwaaterConversation = (conversationId?: string, accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["twaater-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("twaater_messages")
        .select(`
          *,
          sender:twaater_accounts!sender_id(id, handle, display_name, verified)
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      if (!conversationId || !accountId) throw new Error("Missing data");

      const { error } = await supabase
        .from("twaater_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: accountId,
          body,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-conversations"] });
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  return {
    messages,
    isLoading,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  };
};