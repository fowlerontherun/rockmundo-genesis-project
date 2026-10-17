import { supabase } from "@/integrations/supabase/client";

export interface NotificationProfileState {
  notification_id: string;
  read_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
}

/** A notification is unread for a character only if no per-character state hides or reads it. */
export function filterUnreadForCharacter<T extends { id: string }>(
  rows: ReadonlyArray<T>,
  states: ReadonlyArray<NotificationProfileState>,
): T[] {
  const byId = new Map(states.map((s) => [s.notification_id, s]));
  return rows.filter((row) => {
    const s = byId.get(row.id);
    return !s || (!s.read_at && !s.archived_at && !s.deleted_at);
  });
}

/** Unread notifications for the active character, matching what the Inbox shows. */
export async function fetchUnreadCharacterNotifications<T extends { id: string }>(
  userId: string,
  profileId: string,
  columns = "id",
): Promise<T[]> {
  const [rowsResult, statesResult] = await Promise.all([
    (supabase as any).from("notifications").select(columns)
      .eq("user_id", userId).eq("profile_id", profileId).is("read_at", null)
      .order("created_at", { ascending: false }).limit(1000),
    (supabase as any).from("notification_profile_states")
      .select("notification_id,read_at,archived_at,deleted_at")
      .eq("user_id", userId).eq("profile_id", profileId),
  ]);
  if (rowsResult.error) throw rowsResult.error;
  if (statesResult.error) throw statesResult.error;
  return filterUnreadForCharacter<T>(rowsResult.data ?? [], statesResult.data ?? []);
}
