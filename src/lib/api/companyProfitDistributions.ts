import { supabase } from "@/integrations/supabase/client";

export interface CompanyProfitDistributionResult {
  distributedProfit: number;
  gameYear: number;
}

export const distributeCompanyAnnualProfit = async (
  companyId: string,
): Promise<CompanyProfitDistributionResult> => {
  const { data, error } = await (supabase.rpc as any)(
    "distribute_company_annual_profit",
    { p_company_id: companyId },
  );

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("company_profit_distribution_empty_response");

  return {
    distributedProfit: Number(result.distributed_profit),
    gameYear: Number(result.game_year),
  };
};
