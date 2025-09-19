import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
export type SendFriendRequestParams = {

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
export const sendFriendRequest = async ({
  senderProfileId,
  senderUserId,
  recipientProfileId,
  recipientUserId,
}: SendFriendRequestParams) => {
  const payload: Database["public"]["Tables"]["friendships"]["Insert"] = {
    user_id: senderUserId,
    friend_user_id: recipientUserId,
    user_profile_id: senderProfileId,
    friend_profile_id: recipientProfileId,
    status: "pending",
  };

  const { error } = await supabase.from("friendships").insert(payload);

  if (error) {
    throw error;
  }
};
