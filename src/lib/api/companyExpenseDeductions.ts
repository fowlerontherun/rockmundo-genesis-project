import { supabase } from "@/integrations/supabase/client";

export interface CompanyExpenseDeductionResult {
  companyId: string;
  amount: number;
  balance: number;
  financialTransactionId: string;
  idempotent: boolean;
}

export const deductCompanyExpense = async ({
  companyId,
  amount,
  description,
  category,
  idempotencyKey = crypto.randomUUID(),
}: {
  companyId: string;
  amount: number;
  description: string;
  category: string;
  idempotencyKey?: string;
}): Promise<CompanyExpenseDeductionResult> => {
  const { data, error } = await (supabase.rpc as any)("deduct_company_balance", {
    p_company_id: companyId,
    p_amount: amount,
    p_description: description,
    p_category: category,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_expense_deduction_empty_response");
  return data as CompanyExpenseDeductionResult;
};
