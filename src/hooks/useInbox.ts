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

export function useInbox(category?: InboxCategory | 'all') {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['inbox', userId, category],
    queryFn: async () => {
      if (!userId) return [];

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

      return (data || []) as InboxMessage[];
    },
    enabled: !!profileId,
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
      const { error } = await supabase
        .from('player_inbox')
        .update({ is_read: true })
        .eq('id', messageId);

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

      const { error } = await supabase
        .from('player_inbox')
        .update({ is_read: true })
        .eq('user_id', userId)
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
      const { error } = await supabase
        .from('player_inbox')
        .update({ is_archived: true })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-count'] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('player_inbox')
        .delete()
        .eq('id', messageId);

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
  const { userId } = useActiveProfile();

  return useQuery({
    queryKey: ['inbox-unread-count', userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('player_inbox')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) {
        console.error('[useUnreadInboxCount] Error:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
}
