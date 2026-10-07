import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useTwaaterUnreadCount = (accountId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`twaater-notification-count:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "twaater_notifications",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications-unread-count", accountId] });
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications", accountId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "twaater_notifications",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications-unread-count", accountId] });
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications", accountId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  return useQuery({
    queryKey: ["twaater-notifications-unread-count", accountId],
    queryFn: async () => {
      if (!accountId) return 0;

      const { count, error } = await supabase
        .from("twaater_notifications")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId)
        .is("read_at", null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!accountId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useTwaaterNotifications = (accountId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`twaater-notification-list:${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "twaater_notifications",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications", accountId] });
          queryClient.invalidateQueries({ queryKey: ["twaater-notifications-unread-count", accountId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  const { data: notifications, isLoading, error, refetch } = useQuery({
    queryKey: ["twaater-notifications", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("twaater_notifications")
        .select(`
          *,
          source_account:twaater_accounts!source_account_id(id, handle, display_name, verified),
          related_twaat:twaats!related_twaat_id(id, body)
        `)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const unreadCount = notifications?.filter(n => !n.read_at).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("twaater_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-notifications-unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) return;
      
      const { error } = await supabase
        .from("twaater_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("account_id", accountId)
        .is("read_at", null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-notifications-unread-count"] });
    },
  });

  return {
    notifications,
    isLoading,
    error,
    refetch,
    unreadCount,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  };
};