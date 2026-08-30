import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useEffect } from "react";

export type InboxCategory = 
  | 'random_event' 
  | 'gig_result' 
  | 'pr_media' 
  | 'record_label' 
  | 'sponsorship' 
  | 'financial' 
  | 'social' 
  | 'achievement' 
  | 'system';

export type InboxPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface InboxMessage {
  id: string;
  user_id: string;
  category: InboxCategory;
  priority: InboxPriority;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  action_type: string | null;
  action_data: Record<string, unknown> | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  expires_at: string | null;
  created_at: string;
}

export function isInboxMessageForProfile(
  message: Pick<InboxMessage, "metadata">,
  profileId: string | null | undefined,
) {
  if (!profileId) return false;
  const targetProfileId = message.metadata?.profile_id;
  return targetProfileId === profileId || message.metadata?.scope === "account";
}

export function useInbox(category?: InboxCategory | 'all') {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['inbox', userId, profileId, category],
    queryFn: async () => {
      if (!userId || !profileId) return [];

      let queryBuilder = supabase
        .from('player_inbox')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('[useInbox] Error fetching inbox:', error);
        throw error;
      }

      // Untagged legacy rows are not safe to infer in a multi-character account.
      // A genuinely account-wide message must opt in with metadata.scope=account.
      const rows = (data || []) as InboxMessage[];
      return rows.filter((message) => isInboxMessageForProfile(message, profileId));
    },
    enabled: !!userId && !!profileId,
    refetchInterval: 30000,
  });

  // Real-time subscription for new messages
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('inbox-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_inbox',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['inbox'] });
          queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      if (!query.data?.some((message) => message.id === messageId)) {
        throw new Error("Inbox message does not belong to the active character");
      }
      const { error } = await supabase
        .from('player_inbox')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('user_id', userId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const messageIds = (query.data ?? []).filter((message) => !message.is_read).map((message) => message.id);
      if (messageIds.length === 0) return;

      const { error } = await supabase
        .from('player_inbox')
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', messageIds)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
    },
  });

  const archiveMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!query.data?.some((message) => message.id === messageId)) {
        throw new Error("Inbox message does not belong to the active character");
      }
      const { error } = await supabase
        .from('player_inbox')
        .update({ is_archived: true })
        .eq('id', messageId)
        .eq('user_id', userId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!query.data?.some((message) => message.id === messageId)) {
        throw new Error("Inbox message does not belong to the active character");
      }
      const { error } = await supabase
        .from('player_inbox')
        .delete()
        .eq('id', messageId)
        .eq('user_id', userId!);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    archiveMessage: archiveMessage.mutate,
    deleteMessage: deleteMessage.mutate,
    refetch: query.refetch,
  };
}

export function useUnreadInboxCount() {
  const { userId, profileId } = useActiveProfile();

  return useQuery({
    queryKey: ['inbox-unread-count', userId, profileId],
    queryFn: async () => {
      if (!userId || !profileId) return 0;

      const { data, error } = await supabase
        .from('player_inbox')
        .select('metadata')
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) {
        console.error('[useUnreadInboxCount] Error:', error);
        return 0;
      }

      return (data ?? []).filter((message: any) =>
        isInboxMessageForProfile(message, profileId)
      ).length;
    },
    enabled: !!userId && !!profileId,
    refetchInterval: 30000,
  });
}
