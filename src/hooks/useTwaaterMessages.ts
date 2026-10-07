import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const socialMessageError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  if (/row-level security|permission denied|blocked|unavailable/i.test(message)) {
    return "This account is unavailable for direct messages.";
  }
  return "We couldn't complete that message action. Please try again.";
};

export const useTwaaterMessages = (accountId?: string, loadConversations = true) => {
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
    enabled: loadConversations && !!accountId,
  });

  useEffect(() => {
    if (!accountId || !loadConversations) return;

    const channel = supabase
      .channel(`twaater-conversations:${accountId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "twaater_conversations" },
        (payload) => {
          const row = payload.new as { participant_1_id?: string; participant_2_id?: string };
          if (row.participant_1_id !== accountId && row.participant_2_id !== accountId) return;
          queryClient.invalidateQueries({ queryKey: ["twaater-conversations", accountId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, loadConversations, queryClient]);

  const getOrCreateConversationMutation = useMutation({
    mutationFn: async ({ otherAccountId }: { otherAccountId: string }) => {
      if (!accountId) throw new Error("No account ID");

      const [lower, higher] = [accountId, otherAccountId].sort();

      const { data: existing, error: existingError } = await supabase
        .from("twaater_conversations")
        .select("*")
        .eq("participant_1_id", lower)
        .eq("participant_2_id", higher)
        .maybeSingle();

      if (existingError) throw new Error(socialMessageError(existingError));
      if (existing) return existing;

      const { data, error } = await supabase
        .from("twaater_conversations")
        .insert({
          participant_1_id: lower,
          participant_2_id: higher,
        })
        .select()
        .single();

      if (!error) return data;

      // If two tabs/users race to create the same conversation, reuse the
      // row that won instead of surfacing a duplicate-key error.
      if (error.code === "23505") {
        const { data: racedConversation, error: racedError } = await supabase
          .from("twaater_conversations")
          .select("*")
          .eq("participant_1_id", lower)
          .eq("participant_2_id", higher)
          .maybeSingle();

        if (!racedError && racedConversation) return racedConversation;
      }

      throw new Error(socialMessageError(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-conversations"] });
    },
  });

  return {
    conversations,
    isLoading,
    getOrCreateConversation: getOrCreateConversationMutation.mutateAsync,
    isCreatingConversation: getOrCreateConversationMutation.isPending,
  };
};

export const useTwaaterConversation = (conversationId?: string, accountId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["twaater-messages", conversationId, accountId],
    queryFn: async () => {
      if (!conversationId || !accountId) return [];

      const { data: conversation, error: conversationError } = await supabase
        .from("twaater_conversations")
        .select("id")
        .eq("id", conversationId)
        .or(`participant_1_id.eq.${accountId},participant_2_id.eq.${accountId}`)
        .maybeSingle();

      if (conversationError) throw conversationError;
      if (!conversation) return [];

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
    enabled: !!conversationId && !!accountId,
  });

  useEffect(() => {
    if (!conversationId || !accountId) return;

    const channel = supabase
      .channel(`twaater-messages:${conversationId}:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "twaater_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["twaater-messages", conversationId, accountId],
          });
          queryClient.invalidateQueries({ queryKey: ["twaater-conversations", accountId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, accountId, queryClient]);

  useEffect(() => {
    if (!conversationId || !accountId || !messages?.length) return;
    const hasUnreadIncoming = messages.some(
      (message: any) => message.sender_id !== accountId && !message.read_at,
    );
    if (!hasUnreadIncoming) return;

    void supabase
      .from("twaater_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", accountId)
      .is("read_at", null)
      .then(({ error }) => {
        if (error) {
          console.warn("Unable to mark Twaater messages as read:", error);
          return;
        }
        queryClient.invalidateQueries({
          queryKey: ["twaater-messages", conversationId, accountId],
        });
      });
  }, [conversationId, accountId, messages, queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ["twaater-messages", conversationId, accountId] });
      queryClient.invalidateQueries({ queryKey: ["twaater-conversations"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to send message",
        description: socialMessageError(error),
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
