import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
type FriendProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SendFriendRequestParams {
  requestorProfileId?: string;
  addresseeProfileId: string;
}

const PROFILE_SELECTION = "id, user_id, username, display_name, bio, level, fame";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const fetchPrimaryProfileForUser = async (
  userId: string,
): Promise<FriendProfileRow | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECTION)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as FriendProfileRow | null) ?? null;
};

export const fetchFriendshipsForProfile = async (
  profileId: string,
): Promise<FriendshipRow[]> => {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requestor_id, addressee_id, status, created_at, updated_at, responded_at")
    .or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as FriendshipRow[]) ?? [];
};

export const fetchProfilesByIds = async (
  profileIds: string[],
): Promise<Record<string, FriendProfileRow>> => {
  if (profileIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECTION)
    .in("id", profileIds);

  if (error) throw error;
  const rows = (data as FriendProfileRow[]) ?? [];
  return rows.reduce<Record<string, FriendProfileRow>>((accumulator, row) => {
    accumulator[row.id] = row;
    return accumulator;
  }, {});
};

function validateFriendRequestInput(addresseeProfileId: string | null | undefined) {
  if (!addresseeProfileId || !UUID_RE.test(addresseeProfileId)) {
    throw new Error("Choose a valid player to add as a friend.");
  }
  return addresseeProfileId;
}

function friendlyFriendRequestError(message?: string) {
  if (!message) return "We couldn't send that friend request. Please try again.";
  if (/not available|permission denied|row-level security|42501/i.test(message)) {
    return "This player is not available for friend requests.";
  }
  if (/active character|active player profile|not authenticated|jwt|auth/i.test(message)) {
    return "Sign in with an active player profile before sending friend requests.";
  }
  if (/already friends/i.test(message)) return "You are already friends with this player.";
  if (/declined recently|42901/i.test(message)) {
    return "That friend request was declined recently. Please wait before trying again.";
  }
  if (/not found/i.test(message)) return "That player could not be found.";
  return message;
}

export const sendFriendRequest = async ({
  requestorProfileId,
  addresseeProfileId,
}: SendFriendRequestParams): Promise<FriendshipRow> => {
  const targetProfileId = validateFriendRequestInput(addresseeProfileId);
  const { data, error } = await (supabase as any).rpc("send_friend_request", {
    target_profile_id: targetProfileId,
    requestor_profile_id: requestorProfileId ?? null,
  });

  if (error) throw new Error(friendlyFriendRequestError(error.message));
  if (!data) throw new Error("Friend request did not return a friendship.");
  return data as FriendshipRow;
};

export const updateFriendshipStatus = async (
  friendshipId: string,
  status: Exclude<FriendshipStatus, "pending" | "blocked">,
  actorProfileId?: string,
): Promise<FriendshipRow> => {
  const { data, error } = await (supabase as any).rpc("respond_to_friend_request", {
    friendship_id: friendshipId,
    next_status: status,
    actor_profile_id: actorProfileId ?? null,
  });
  if (error) throw new Error(error.message || "Friendship update failed.");
  return data as FriendshipRow;
};

export const deleteFriendship = async (
  friendshipId: string,
  actorProfileId?: string,
): Promise<void> => {
  const { error } = await (supabase as any).rpc("respond_to_friend_request", {
    friendship_id: friendshipId,
    next_status: "cancelled",
    actor_profile_id: actorProfileId ?? null,
  });
  if (error) throw new Error(error.message || "Friend request could not be withdrawn.");
};

export const removeFriendship = async (
  friendshipId: string,
  actorProfileId?: string,
): Promise<void> => {
  const { error } = await (supabase as any).rpc("respond_to_friend_request", {
    friendship_id: friendshipId,
    next_status: "removed",
    actor_profile_id: actorProfileId ?? null,
  });
  if (error) throw new Error(error.message || "Friendship could not be removed.");
};

export const blockProfile = async (
  targetProfileId: string,
  actorProfileId?: string,
  note?: string,
) => {
  const { data, error } = await (supabase as any).rpc("block_profile", {
    target_profile_id: targetProfileId,
    actor_profile_id: actorProfileId ?? null,
    note: note ?? null,
  });
  if (error) throw new Error(error.message || "Player could not be blocked.");
  return data;
};

export const unblockProfile = async (targetProfileId: string, actorProfileId?: string) => {
  const { data, error } = await (supabase as any).rpc("unblock_profile", {
    target_profile_id: targetProfileId,
    actor_profile_id: actorProfileId ?? null,
  });
  if (error) throw new Error(error.message || "Player could not be unblocked.");
  return Boolean(data);
};

export const __friendRequestTestUtils = {
  friendlyFriendRequestError,
  validateFriendRequestInput,
};

export const searchProfilesByQuery = async (
  query: string,
  excludeProfileIds: string[] = [],
): Promise<FriendProfileRow[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECTION)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("username")
    .limit(20);

  if (error) throw error;
  const rows = (data as FriendProfileRow[]) ?? [];
  if (excludeProfileIds.length === 0) return rows;
  const exclusionSet = new Set(excludeProfileIds);
  return rows.filter((row) => !exclusionSet.has(row.id));
};
