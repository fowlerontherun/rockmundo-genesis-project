import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FriendRequestRow = Database["public"]["Tables"]["friend_requests"]["Row"];
export type FriendRequestStatus = Database["public"]["Enums"]["friend_request_status"];

export interface SendFriendRequestInput {
  senderProfileId: string;
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
  message?: string;
}

export const sendFriendRequest = async (
  input: SendFriendRequestInput,
): Promise<FriendRequestRow> => {
  const payload = {
    sender_profile_id: input.senderProfileId,
    sender_user_id: input.senderUserId,
    recipient_profile_id: input.recipientProfileId,
    recipient_user_id: input.recipientUserId,
    message: input.message ?? null,
  } satisfies Database["public"]["Tables"]["friend_requests"]["Insert"];

  const { data, error } = await supabase
    .from("friend_requests")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};
