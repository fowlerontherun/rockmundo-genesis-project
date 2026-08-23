import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalBudgetForecast,
  type FestivalBudgetForecast,
} from "./model";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

const client = supabase as unknown as RpcClient;

export async function getFestivalBudgetForecast(
  festivalCompanyId: string,
  festivalEditionId: string,
): Promise<FestivalBudgetForecast> {
  const { data, error } = await client.rpc("get_festival_edition_budget_forecast", {
    p_festival_company_id: festivalCompanyId,
    p_festival_edition_id: festivalEditionId,
  });
  if (error) throw new Error(error.message);
  return parseFestivalBudgetForecast(data);
}
