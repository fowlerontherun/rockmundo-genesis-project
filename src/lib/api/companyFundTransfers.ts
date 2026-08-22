import { supabase } from "@/integrations/supabase/client";

export type CompanyFundTransferKind = "deposit" | "withdrawal" | "intercompany";

export interface CompanyFundTransferResult {
  transferKind: CompanyFundTransferKind;
  sourceCompanyId: string;
  destinationCompanyId: string | null;
  amount: number;
  personalCash: number;
  sourceBalance: number;
  destinationBalance: number | null;
  financialTransactionId: string | null;
  idempotent: boolean;
}

const createIdempotencyKey = (): string => crypto.randomUUID();

export const transferCompanyFunds = async ({
  transferKind,
  companyId,
  amount,
  destinationCompanyId,
  idempotencyKey = createIdempotencyKey(),
}: {
  transferKind: CompanyFundTransferKind;
  companyId: string;
  amount: number;
  destinationCompanyId?: string;
  idempotencyKey?: string;
}): Promise<CompanyFundTransferResult> => {
  const { data, error } = await (supabase.rpc as any)("transfer_company_funds", {
    p_transfer_kind: transferKind,
    p_company_id: companyId,
    p_amount: amount,
    p_destination_company_id: destinationCompanyId ?? null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_fund_transfer_empty_response");

  return data as CompanyFundTransferResult;
};