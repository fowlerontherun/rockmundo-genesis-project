import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type PlayerXpWalletRow = Tables<"player_xp_wallet">;

export const fetchWalletForProfile = async (
  profileId: string,
): Promise<PlayerXpWalletRow | null> => {
  const { data, error } = await supabase
    .from("player_xp_wallet")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PlayerXpWalletRow | null) ?? null;
};

export interface GiftFundsParams {
  senderProfileId: string;
  recipientProfileId: string;
  amount: number;
}

export interface GiftFundsResult {
  senderProfileId: string;
  senderBalance: number;
  recipientProfileId: string;
  recipientBalance: number;
}

export const giftWalletFunds = async ({
  senderProfileId,
  recipientProfileId,
  amount,
}: GiftFundsParams): Promise<GiftFundsResult> => {
  const { data, error } = await supabase.rpc("gift_wallet_funds", {
    p_sender_profile_id: senderProfileId,
    p_recipient_profile_id: recipientProfileId,
    p_amount: Math.round(amount),
  });

  if (error) {
    throw error;
  }

  const [result] = ((data as any) ?? []).map((row: any) => ({
    senderProfileId: row.sender_profile_id,
    senderBalance: row.sender_balance, 
    recipientProfileId: row.recipient_profile_id,
    recipientBalance: row.recipient_balance,
  }));

  if (!result) {
    throw new Error("Gift transfer did not return a result.");
  }

  return result;
};
