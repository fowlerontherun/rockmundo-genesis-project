import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
type FriendProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface SendFriendRequestParams {
  requestorProfileId: string;
  addresseeProfileId: string;
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
    .select("id, requestor_id, addressee_id, status, created_at, updated_at, responded_at")
    .or(`requestor_id.eq.${profileId},addressee_id.eq.${profileId}`)
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
    .select("id, requestor_id, addressee_id, status, created_at, updated_at, responded_at")
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
  requestorProfileId,
  addresseeProfileId,
}: SendFriendRequestParams): Promise<FriendshipRow> => {
  const payload: Database["public"]["Tables"]["friendships"]["Insert"] = {
    requestor_id: requestorProfileId,
    addressee_id: addresseeProfileId,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("friendships")
    .insert(payload)
    .select("id, requestor_id, addressee_id, status, created_at, updated_at, responded_at")
    .single();

  if (error) {
    throw error;
  }

  return data as FriendshipRow;
};

export const deleteFriendship = async (friendshipId: string): Promise<void> => {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

  if (error) {
    throw error;
  }
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

  if (error) {
    throw error;
  }

  const rows = (data as FriendProfileRow[]) ?? [];

  if (excludeProfileIds.length === 0) {
    return rows;
  }

  const exclusionSet = new Set(excludeProfileIds);
  return rows.filter((row) => !exclusionSet.has(row.id));
};
