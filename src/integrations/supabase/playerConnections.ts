import { supabase } from "@/integrations/supabase/client";
import { sendFriendRequest } from "@/integrations/supabase/friends";

export type ConnectionState = "self" | "not_connected" | "outgoing_pending" | "incoming_pending" | "friends" | "blocked_by_viewer" | "viewer_blocked" | "restricted" | "unavailable";
export type ManagedFriendshipStatus = "suggested" | "pending" | "accepted" | "declined" | "cancelled" | "removed" | "expired" | "blocked";
export type FriendListKind = "friends" | "incoming" | "outgoing" | "recent";

export interface FriendSummary { id: string; friendshipId: string; characterName: string; username?: string | null; avatarUrl?: string | null; cityName?: string | null; bandName?: string | null; primaryRole?: string | null; status: ManagedFriendshipStatus; requestedAt: string; friendshipDate?: string | null; mutualFriendCount: number | null; }

export async function getConnectionState(targetProfileId: string, viewerProfileId?: string | null): Promise<ConnectionState> {
  const { data, error } = await (supabase as any).rpc("get_connection_state", {
    target_profile_id: targetProfileId,
    viewer_profile_id: viewerProfileId ?? null,
  });
  if (error) throw error;
  return (data ?? "unavailable") as ConnectionState;
}

export async function sendConnectionRequest(targetProfileId: string, requestorProfileId?: string | null) {
  return sendFriendRequest({ requestorProfileId: requestorProfileId ?? undefined, addresseeProfileId: targetProfileId });
}

export async function respondToFriendship(
  friendshipId: string,
  nextStatus: Exclude<ManagedFriendshipStatus, "pending" | "blocked" | "expired">,
  actorProfileId?: string | null,
) {
  const { data, error } = await (supabase as any).rpc("respond_to_friend_request", {
    friendship_id: friendshipId,
    next_status: nextStatus,
    actor_profile_id: actorProfileId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getFriendRequestCounts(profileId?: string | null): Promise<{ friends: number; incoming: number; outgoing: number }> {
  const { data, error } = await (supabase as any).rpc("get_friend_request_counts", { profile_id: profileId ?? null });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { friends: Number(row?.friends ?? 0), incoming: Number(row?.incoming ?? 0), outgoing: Number(row?.outgoing ?? 0) };
}

export async function listFriendships(profileId: string, kind: FriendListKind, search = ""): Promise<FriendSummary[]> {
  let query = (supabase as any).from("friendships").select("id, requestor_id, addressee_id, status, created_at, responded_at, profiles!friendships_requestor_id_fkey(id, username, display_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)").or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`).order("updated_at", { ascending: false });
  if (kind === "friends" || kind === "recent") query = query.eq("status", "accepted");
  if (kind === "incoming") query = query.eq("status", "pending").eq("addressee_id", profileId);
  if (kind === "outgoing") query = query.eq("status", "pending").eq("requestor_id", profileId);
  const data: any[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const { data: page, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    data.push(...(page ?? []));
    if (!page || page.length < 500) break;
  }
  const summaries: FriendSummary[] = data.map((row) => {
    const other = row.requestor_id === profileId ? row.addressee : row.profiles;
    return { id: other?.id, friendshipId: row.id, characterName: other?.display_name || other?.username || "Unavailable player", username: other?.username, avatarUrl: other?.avatar_url, cityName: null, status: row.status, requestedAt: row.created_at, friendshipDate: row.responded_at, mutualFriendCount: null };
  }).filter(row => Boolean(row.id));
  const ids = summaries.map(row => row.id);
  if (ids.length) {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const { data: memberships, error } = await (supabase as any).from("band_members")
        .select("profile_id, instrument_role, role, bands(name)")
        .in("profile_id", ids.slice(offset, offset + 100))
        .eq("member_status", "active");
      if (error) throw error;
      for (const member of (memberships ?? []) as any[]) {
        const row = summaries.find(item => item.id === member.profile_id);
        if (!row) continue;
        row.bandName ||= member.bands?.name ?? null;
        row.primaryRole ||= member.instrument_role || member.role || null;
      }
    }
  }
  // A server-authorised aggregate includes mutual friends invisible under
  // direct friendship RLS. Never display a fabricated "0 mutual friends" when
  // counts are unavailable or this is not an accepted friendship.
  if (ids.length && (kind === "friends" || kind === "recent")) {
    const { data: counts, error: countError } = await (supabase as any)
      .rpc("get_mutual_friend_counts", {
        p_profile_id: profileId,
        p_other_profile_ids: ids,
      });
    if (!countError && counts && typeof counts === "object") {
      for (const friend of summaries) {
        const value = Number((counts as Record<string, unknown>)[friend.id]);
        if (Number.isSafeInteger(value) && value >= 0 &&
            Object.prototype.hasOwnProperty.call(counts, friend.id)) {
          friend.mutualFriendCount = value;
        }
      }
    }
  }
  const term = search.trim().toLowerCase();
  return summaries.filter(row => !term || `${row.characterName} ${row.username ?? ""} ${row.cityName ?? ""} ${row.bandName ?? ""} ${row.primaryRole ?? ""}`.toLowerCase().includes(term));
}

export async function listFriendSuggestions(profileId: string): Promise<FriendSummary[]> {
  if (!profileId) return [];

  // Do not read raw profiles or client-visible blocks. The SECURITY DEFINER
  // function checks both block directions, live-character status and profile
  // visibility before returning any identity or city fields.
  const { data, error } = await (supabase as any).rpc(
    "get_safe_friend_suggestions",
    { p_profile_id: profileId, p_limit: 6 },
  );
  if (error) throw error; // Denied / unavailable check must fail closed.
  if (!Array.isArray(data)) throw new Error("Friend suggestion response is invalid.");

  return data.map((p: any) => ({
    id: p.id,
    friendshipId: "",
    characterName: p.display_name || p.username || "Player",
    username: p.username,
    avatarUrl: p.avatar_url,
    cityName: p.city_name ?? null,
    status: "suggested" as const,
    requestedAt: "",
    mutualFriendCount: null,
    primaryRole: null,
  }));
}
