import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SendFriendRequestParams = {
  senderProfileId: string;
  senderUserId: string;
  recipientProfileId: string;
  recipientUserId: string;
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
