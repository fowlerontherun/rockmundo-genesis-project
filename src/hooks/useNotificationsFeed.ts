import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { asAny } from "@/lib/type-helpers";
import { beforeCreatedAtId, lastCreatedAtIdCursor } from "@/lib/inboxKeyset";

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
  archived_at?: string | null;
  deleted_at?: string | null;
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
      let cursor: { created_at: string; id: string } | null = null;
      let complete = false;
      for (let page = 0; page < 100; page++) {
        // PostgREST .or() replaces the previous OR parameter, so combine the
        // character predicate and keyset predicate in a single expression.
        const before = cursor ? beforeCreatedAtId(cursor) : null;
        const scope = before
          ? `and(profile_id.eq.${profileId},or(${before})),and(profile_id.is.null,or(${before}))`
          : `profile_id.eq.${profileId},profile_id.is.null`;
        const { data, error } = await supabase.from(asAny("notifications"))
          .select("*")
          .eq("user_id", userId)
          .or(scope)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1000);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as PersistedNotification[]));
        if (!data || data.length < 1000) { complete = true; break; }
        const next = lastCreatedAtIdCursor(data);
        if (!next || (cursor && next.created_at === cursor.created_at && next.id === cursor.id)) {
          throw new Error("Notification pagination failed to advance");
        }
        cursor = next;
      }
      if (!complete) throw new Error("Notification history exceeds pagination safety limit");

      const { data: states, error: stateError } = await supabase
        .from(asAny("notification_profile_states"))
        .select("notification_id,read_at,archived_at,deleted_at")
        .eq("user_id", userId)
        .eq("profile_id", profileId);
      if (stateError) throw stateError;
      const byId = new Map((states ?? []).map((state: any) => [state.notification_id, state]));
      return all.map((notification) => {
        const state: any = byId.get(notification.id);
        return {
          ...notification,
          read_at: state?.read_at ?? notification.read_at,
          archived_at: state?.archived_at ?? null,
          deleted_at: state?.deleted_at ?? null,
        };
      });
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
    const stateChannel = supabase
      .channel(`notification-state:${userId}:${profileId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notification_profile_states",
        filter: `profile_id=eq.${profileId}`,
      }, () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] }))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(stateChannel);
    };
  }, [userId, profileId, qc]);

  const inActiveCharacter = (notification: PersistedNotification) =>
    notification.profile_id === profileId ||
    (notification.profile_id === null && (notification.metadata?.profile_id == null || notification.metadata.profile_id === profileId));

  const setState = async (ids: string[], action: "read" | "archive" | "delete") => {
    if (!userId || !profileId) throw new Error("Select a character to manage notifications");
    if (ids.length === 0) return;
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await (supabase as any).rpc("set_notification_profile_states", {
        p_profile_id: profileId,
        p_notification_ids: ids.slice(i, i + 100),
        p_action: action,
      });
      if (error) throw error;
    }
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: [...QUERY_KEY, userId, profileId] });
  const eligible = (ids: string[]) => {
    const allowed = new Set((query.data ?? [])
      .filter((n) => inActiveCharacter(n) && !n.deleted_at)
      .map((n) => n.id));
    return [...new Set(ids)].filter((id) => allowed.has(id));
  };

  const markRead = useMutation({
    mutationFn: (id: string) => setState(eligible([id]), "read"),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: (ids: string[]) => setState(eligible(ids), "read"),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (id: string) => setState(eligible([id]), "archive"),
    onSuccess: invalidate,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => setState(eligible([id]), "delete"),
    onSuccess: invalidate,
  });
  const clearAll = useMutation({
    mutationFn: () => setState(eligible((query.data ?? []).filter((n) => !n.archived_at).map((n) => n.id)), "delete"),
    onSuccess: invalidate,
  });

  const notifications = (query.data ?? []).filter((n) => !n.deleted_at && !n.archived_at && inActiveCharacter(n));
  const archivedNotifications = (query.data ?? []).filter((n) => !n.deleted_at && !!n.archived_at && inActiveCharacter(n));
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    archivedNotifications,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    archive: archive.mutate,
    dismiss: dismiss.mutate,
    clearAll: clearAll.mutate,
  };
}
