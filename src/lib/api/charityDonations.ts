import { supabase } from "@/integrations/supabase/client";

export interface CharityDonationResult {
  donationId: string;
  transactionId: string;
  charityId: string;
  charityName?: string;
  currencyCode: string;
  amountMinor: number;
  walletBalanceMinor: number;
  fameGained: number;
  reputationGained: number;
  requestedReputationGained?: number;
  idempotent: boolean;
}

export async function makeCharityDonation(
  charityId: string,
  amountMinor: number,
  idempotencyKey: string,
): Promise<CharityDonationResult> {
  const { data, error } = await (supabase as any).rpc("make_my_charity_donation", {
    p_charity_id: charityId,
    p_amount_minor: amountMinor,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`Charity donation failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("Charity donation failed: no result returned");
  }

  return data as CharityDonationResult;
}
