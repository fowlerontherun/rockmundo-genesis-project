import { supabase } from "@/integrations/supabase/client";
import { sendFriendRequest } from "@/integrations/supabase/friends";

export type ConnectionState = "self" | "not_connected" | "outgoing_pending" | "incoming_pending" | "friends" | "blocked_by_viewer" | "viewer_blocked" | "restricted" | "unavailable";
export type ManagedFriendshipStatus = "pending" | "accepted" | "declined" | "cancelled" | "removed" | "expired" | "blocked";
export type FriendListKind = "friends" | "incoming" | "outgoing" | "recent";

export interface FriendSummary { id: string; friendshipId: string; characterName: string; username?: string | null; avatarUrl?: string | null; cityName?: string | null; bandName?: string | null; primaryRole?: string | null; status: ManagedFriendshipStatus; requestedAt: string; friendshipDate?: string | null; mutualFriendCount: number; }

export async function getConnectionState(targetProfileId: string): Promise<ConnectionState> {
  const { data, error } = await (supabase as any).rpc("get_connection_state", { target_profile_id: targetProfileId });
  if (error) throw error;
  return (data ?? "unavailable") as ConnectionState;
}

export async function sendConnectionRequest(targetProfileId: string) { return sendFriendRequest({ requestorProfileId: "server-controlled", addresseeProfileId: targetProfileId }); }
export async function respondToFriendship(friendshipId: string, nextStatus: Exclude<ManagedFriendshipStatus, "pending" | "blocked" | "expired">) {
  const { data, error } = await (supabase as any).rpc("respond_to_friend_request", { friendship_id: friendshipId, next_status: nextStatus });
  if (error) throw error;
  return data;
}

export async function getFriendRequestCounts(): Promise<{ friends: number; incoming: number; outgoing: number }> {
  const { data, error } = await (supabase as any).rpc("get_friend_request_counts");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { friends: Number(row?.friends ?? 0), incoming: Number(row?.incoming ?? 0), outgoing: Number(row?.outgoing ?? 0) };
}

export async function listFriendships(profileId: string, kind: FriendListKind, search = ""): Promise<FriendSummary[]> {
  let query = (supabase as any).from("friendships").select("id, requestor_id, addressee_id, status, created_at, accepted_at, responded_at, profiles!friendships_requestor_id_fkey(id, username, display_name, avatar_url, city_name), addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, city_name)").or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`).order("updated_at", { ascending: false }).limit(50);
  if (kind === "friends" || kind === "recent") query = query.eq("status", "accepted");
  if (kind === "incoming") query = query.eq("status", "pending").eq("addressee_id", profileId);
  if (kind === "outgoing") query = query.eq("status", "pending").eq("requestor_id", profileId);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => {
    const other = row.requestor_id === profileId ? row.addressee : row.profiles;
    return { id: other?.id, friendshipId: row.id, characterName: other?.display_name || other?.username || "Unavailable player", username: other?.username, avatarUrl: other?.avatar_url, cityName: other?.city_name, status: row.status, requestedAt: row.created_at, friendshipDate: row.accepted_at ?? row.responded_at, mutualFriendCount: 0 };
  }).filter((row) => row.id && (!search || `${row.characterName} ${row.username ?? ""} ${row.cityName ?? ""}`.toLowerCase().includes(search.toLowerCase())));
}

export async function listFriendSuggestions(profileId: string): Promise<FriendSummary[]> {
  const existing = await listFriendships(profileId, "friends");
  const { data: blockRows } = await (supabase as any).from("player_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`).is("removed_at", null);
  const blockedIds = ((blockRows ?? []) as any[]).map((row) => row.blocker_id === profileId ? row.blocked_id : row.blocker_id);
  const exclude = new Set([profileId, ...existing.map((f) => f.id), ...blockedIds]);
  const { data, error } = await (supabase as any).from("profiles").select("id, username, display_name, avatar_url, city_name").limit(12);
  if (error) throw error;
  return ((data ?? []) as any[]).filter((p) => !exclude.has(p.id)).slice(0, 6).map((p) => ({ id: p.id, friendshipId: "", characterName: p.display_name || p.username || "Player", username: p.username, avatarUrl: p.avatar_url, cityName: p.city_name, status: "pending", requestedAt: new Date().toISOString(), mutualFriendCount: 0, primaryRole: "Suggested because they are active in the community" }));
}
