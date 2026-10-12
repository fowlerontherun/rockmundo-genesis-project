import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
  const { userId, profileId } = useActiveProfile();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId, profileId],
    enabled: !!userId && !!profileId,
    queryFn: async (): Promise<PersistedNotification[]> => {
      if (!userId || !profileId) return [];
      const all: PersistedNotification[] = [];
      for (let start = 0; start < 100_000; start += 1000) {
        const { data, error } = await supabase.from(asAny("notifications")).select("*").eq("user_id", userId).or(`profile_id.eq.${profileId},profile_id.is.null`).order("created_at", { ascending: false }).order("id", { ascending: false }).range(start, start + 999);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as PersistedNotification[]));
        if (!data || data.length < 1000) return all;
      }
      throw new Error("Notification history exceeds pagination safety limit");
    },
  });

  useEffect(() => {
    if (!userId || !profileId) return;
    const channel = supabase
      .channel(`notifications:${userId}:${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, profileId, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      if (!profileId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .update({ read_at: new Date().toISOString() } as never)
        .eq("id", id)
        .eq("user_id", userId!)
        .or(`profile_id.eq.${profileId},profile_id.is.null`);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId || !profileId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .update({ read_at: new Date().toISOString() } as never)
        .eq("user_id", userId)
        .or(`profile_id.eq.${profileId},profile_id.is.null`)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      if (!profileId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .delete()
        .eq("id", id)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!userId || !profileId) return;
      const { error } = await supabase
        .from(asAny("notifications"))
        .delete()
        .eq("user_id", userId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] }),
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    dismiss: dismiss.mutate,
    clearAll: clearAll.mutate,
  };
}
