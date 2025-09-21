import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
export type FriendProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface AcceptedFriendProfile {
  friendshipId: string;
  partnerProfileId: string;
  partnerUserId: string;
  partnerProfile: FriendProfileRow | null;
}

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

export const fetchAcceptedFriendsForProfile = async (
  profileId: string,
): Promise<AcceptedFriendProfile[]> => {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, status, user_id, friend_user_id, user_profile_id, friend_profile_id,
      user_profile:user_profile_id (${PROFILE_SELECTION}),
      friend_profile:friend_profile_id (${PROFILE_SELECTION})`,
    )
    .eq("status", "accepted")
    .or(`user_profile_id.eq.${profileId},friend_profile_id.eq.${profileId}`);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as (FriendshipRow & {
    user_profile: FriendProfileRow | null;
    friend_profile: FriendProfileRow | null;
  })[];

  return rows
    .map<AcceptedFriendProfile | null>((row) => {
      const isRequester = row.user_profile_id === profileId;
      const partnerProfile = isRequester ? row.friend_profile : row.user_profile;
      const partnerProfileId = isRequester ? row.friend_profile_id : row.user_profile_id;
      const partnerUserId = isRequester ? row.friend_user_id : row.user_id;

      if (!partnerProfileId) {
        return null;
      }

      return {
        friendshipId: row.id,
        partnerProfileId,
        partnerUserId,
        partnerProfile: partnerProfile ?? null,
      };
    })
    .filter((entry): entry is AcceptedFriendProfile => entry !== null);
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
