import { supabase } from "@/integrations/supabase/client";
import type { CompanyType, CreateCompanyInput } from "@/types/company";

export interface FoundCompanyResult {
  companyId: string;
  personalCash: number;
  foundingCost: number;
  startingBalance: number;
  weeklyOperatingCosts: number;
  financialTransactionId?: string;
  idempotent: boolean;
}

export interface FoundCompanyInput extends CreateCompanyInput {
  company_type: Exclude<CompanyType, "festival">;
}

const createIdempotencyKey = (): string => crypto.randomUUID();

export const foundCompany = async (
  input: FoundCompanyInput,
  idempotencyKey = createIdempotencyKey(),
): Promise<FoundCompanyResult> => {
  const { data, error } = await (supabase.rpc as any)("found_company", {
    p_name: input.name,
    p_company_type: input.company_type,
    p_description: input.description ?? null,
    p_headquarters_city_id: input.headquarters_city_id ?? null,
    p_parent_company_id: input.parent_company_id ?? null,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("company_founding_empty_response");

  return data as FoundCompanyResult;
};
