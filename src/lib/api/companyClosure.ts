import { supabase } from "@/integrations/supabase/client";

export interface CloseCompanyResult {
  companyId: string;
  companyName: string;
  transferredAmount: number;
  personalCash: number;
  status: "dissolved";
  idempotent: boolean;
}

const createIdempotencyKey = (): string => crypto.randomUUID();

export const closeCompany = async (
  companyId: string,
  transferBalance = true,
  idempotencyKey = createIdempotencyKey(),
): Promise<CloseCompanyResult> => {
  const { data, error } = await (supabase.rpc as any)("close_company", {
    p_company_id: companyId,
    p_transfer_balance: transferBalance,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_closure_empty_response");

  return data as CloseCompanyResult;
};
