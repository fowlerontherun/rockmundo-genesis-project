import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
type FriendProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SendFriendRequestParams {
  senderProfileId: string;
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
  message?: string | null;
}

const PROFILE_SELECTION = "id, user_id, username, display_name, bio, level, fame";

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
    .select(
      "id, user_id, friend_user_id, user_profile_id, friend_profile_id, status, created_at, updated_at",
    )
    .or(`user_profile_id.eq.${profileId},friend_profile_id.eq.${profileId}`)
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
    .select(
      "id, user_id, friend_user_id, user_profile_id, friend_profile_id, status, created_at, updated_at",
    )
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

export const sendFriendRequest = async ({
  senderProfileId,
  senderUserId,
  recipientProfileId,
  recipientUserId,
}: SendFriendRequestParams): Promise<FriendshipRow> => {
  const payload: Database["public"]["Tables"]["friendships"]["Insert"] = {
    user_id: senderUserId,
    friend_user_id: recipientUserId,
    user_profile_id: senderProfileId,
    friend_profile_id: recipientProfileId,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("friendships")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FriendshipRow;
};
