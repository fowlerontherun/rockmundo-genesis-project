import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { asAny } from "@/lib/type-helpers";

export interface PersistedNotification {
  id: string;
  user_id: string;
  profile_id: string | null;
  category: string;
  type: string;
  title: string;
  message: string;
  action_path: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const QUERY_KEY = ["notifications-feed"] as const;

export function useNotificationsFeed() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async (): Promise<PersistedNotification[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from(asAny("notifications"))
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PersistedNotification[];
    },
  });

  // Realtime updates
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(asAny("notifications"))
        .update({ read_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .update({ read_at: new Date().toISOString() } as never)
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(asAny("notifications"))
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId] }),
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    dismiss: dismiss.mutate,
    clearAll: clearAll.mutate,
  };
}
