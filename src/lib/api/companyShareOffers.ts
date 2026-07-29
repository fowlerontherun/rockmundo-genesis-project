import { supabase } from "@/integrations/supabase/client";

export type CompanyShareOfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export interface CompanyShareOfferResult {
  offerId: string;
  status: CompanyShareOfferStatus;
  companyId: string;
  recipientProfileId: string;
  recipientUserId: string;
  shares: number;
  pricePerShare: number;
  totalPrice: number;
  companyBalance: number | null;
  recipientCash: number | null;
  newOwnerId: string | null;
  financialTransactionId: string | null;
  idempotent: boolean;
}

const createIdempotencyKey = (): string => crypto.randomUUID();

export const proposeCompanyShareIssuance = async ({
  companyId,
  recipientProfileId,
  shares,
  pricePerShare,
  idempotencyKey = createIdempotencyKey(),
}: {
  companyId: string;
  recipientProfileId: string;
  shares: number;
  pricePerShare: number;
  idempotencyKey?: string;
}): Promise<CompanyShareOfferResult> => {
  const { data, error } = await (supabase.rpc as any)("propose_company_share_issuance", {
    p_company_id: companyId,
    p_recipient_profile_id: recipientProfileId,
    p_shares: shares,
    p_price_per_share: pricePerShare,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_share_offer_empty_response");
  return data as CompanyShareOfferResult;
};

export const respondCompanyShareOffer = async ({
  offerId,
  accept,
  idempotencyKey = createIdempotencyKey(),
}: {
  offerId: string;
  accept: boolean;
  idempotencyKey?: string;
}): Promise<CompanyShareOfferResult> => {
  const { data, error } = await (supabase.rpc as any)("respond_company_share_offer", {
    p_offer_id: offerId,
    p_accept: accept,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_share_offer_response_empty_response");
  return data as CompanyShareOfferResult;
};
