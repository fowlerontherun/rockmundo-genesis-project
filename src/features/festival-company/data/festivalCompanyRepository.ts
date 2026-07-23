import { supabase } from "@/integrations/supabase/client";
import type { FoundFestivalCompanyInput, FoundFestivalCompanyResult } from "../domain/festivalCompany";

interface FoundFestivalCompanyRpcResult {
  companyId: string;
  festivalCompanyId: string;
  personalCash: number;
  foundingCost: number;
  idempotent: boolean;
}

export const foundFestivalCompany = async (
  input: FoundFestivalCompanyInput,
): Promise<FoundFestivalCompanyResult> => {
  const { data, error } = await supabase.rpc("found_festival_company", {
    p_company_name: input.companyName,
    p_public_name: input.publicName,
    p_description: input.description || null,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throw error;
  const result = data as FoundFestivalCompanyRpcResult;
  return {
    companyId: result.companyId,
    festivalCompanyId: result.festivalCompanyId,
    personalCash: Number(result.personalCash),
    foundingCost: Number(result.foundingCost),
    idempotent: Boolean(result.idempotent),
  };
};
