import { supabase } from "@/integrations/supabase/client";

export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";
export type FriendPresenceStatus = "online" | "typing" | "muted";

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface FriendProfileRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number | null;
  fame: number | null;
}

export interface SendFriendRequestParams {
  senderProfileId: string;
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
  message?: string | null;
}

const PROFILE_SELECTION = "id, user_id, username, display_name, avatar_url, bio, level, fame";

export const sendFriendRequest = async (
  params: SendFriendRequestParams,
): Promise<FriendshipRow> => {
  const { data, error } = await supabase
    .from("friendships")
    .insert({
      requester_id: params.senderProfileId,
      addressee_id: params.recipientProfileId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FriendshipRow;
};

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

  if (error) {
    throw error;
  }

  return (data as FriendProfileRow | null) ?? null;
};

export const fetchFriendshipsForProfile = async (
  profileId: string,
): Promise<FriendshipRow[]> => {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, updated_at, responded_at")
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as FriendshipRow[]) ?? [];
};

export const updateFriendshipStatus = async (
  friendshipId: string,
  status: Exclude<FriendshipStatus, "pending">,
): Promise<FriendshipRow> => {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status })
    .eq("id", friendshipId)
    .select("id, requester_id, addressee_id, status, created_at, updated_at, responded_at")
    .single();

  if (error) {
    throw error;
  }

  return data as FriendshipRow;
};

export const fetchProfilesByIds = async (
  profileIds: string[],
): Promise<Record<string, FriendProfileRow>> => {
  if (profileIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECTION)
    .in("id", profileIds);

  if (error) {
    throw error;
  }

  const rows = (data as FriendProfileRow[]) ?? [];
  return rows.reduce<Record<string, FriendProfileRow>>((accumulator, row) => {
    accumulator[row.id] = row;
    return accumulator;
  }, {});
};

export const fetchPresenceByUserIds = async (
  userIds: string[],
): Promise<Record<string, FriendPresenceStatus>> => {
  if (userIds.length === 0) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from("chat_participants")
      .select("user_id, status")
      .in("user_id", userIds);

    if (error) {
      throw error;
    }

    const rows = (data as { user_id: string; status: string }[]) ?? [];
    return rows.reduce<Record<string, FriendPresenceStatus>>((accumulator, row) => {
      if (row.user_id && (row.status === "online" || row.status === "typing" || row.status === "muted")) {
        accumulator[row.user_id] = row.status;
      }
      return accumulator;
    }, {});
  } catch (presenceError) {
    console.error("Failed to load presence information", presenceError);
    return {};
  }
};
