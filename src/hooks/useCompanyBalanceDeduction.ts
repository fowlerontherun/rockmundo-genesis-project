import { supabase } from "@/integrations/supabase/client";
import { deductCompanyExpense } from "@/lib/api/companyExpenseDeductions";

/**
 * Deducts an amount from a company's balance through the authoritative,
 * transactional company-expense boundary.
 */
export async function deductCompanyBalance({
  companyId,
  amount,
  description,
  category,
}: {
  companyId: string;
  amount: number;
  description: string;
  category: string;
}) {
  return deductCompanyExpense({
    companyId,
    amount,
    description,
    category,
  });
}

/** Look up company_id from a security_firms row */
export async function getCompanyIdFromSecurityFirm(firmId: string): Promise<string> {
  const { data, error } = await supabase
    .from("security_firms")
    .select("company_id")
    .or(`id.eq.${firmId},company_id.eq.${firmId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Security firm not found");
  return data.company_id;
}

/** Look up company_id from a merch_factories row */
export async function getCompanyIdFromMerchFactory(factoryId: string): Promise<string> {
  const { data, error } = await supabase
    .from("merch_factories")
    .select("company_id")
    .or(`id.eq.${factoryId},company_id.eq.${factoryId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Merch factory not found");
  return data.company_id;
}

/** Look up company_id from a logistics_companies row */
export async function getCompanyIdFromLogistics(logisticsId: string): Promise<string> {
  const { data, error } = await supabase
    .from("logistics_companies")
    .select("company_id")
    .or(`id.eq.${logisticsId},company_id.eq.${logisticsId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Logistics company not found");
  return data.company_id;
}

/** Look up company_id from a venues row */
export async function getCompanyIdFromVenue(venueId: string): Promise<string> {
  // Try by id first, then by company_id (dual lookup)
  const { data, error } = await supabase
    .from("venues")
    .select("company_id")
    .or(`id.eq.${venueId},company_id.eq.${venueId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data?.company_id) throw new Error("Venue company not found");
  return data.company_id;
}

/** Look up company_id from a rehearsal_rooms row */
export async function getCompanyIdFromRehearsalRoom(roomId: string): Promise<string> {
  // Try by id first, then by company_id (dual lookup)
  const { data, error } = await supabase
    .from("rehearsal_rooms")
    .select("company_id")
    .or(`id.eq.${roomId},company_id.eq.${roomId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data?.company_id) throw new Error("Rehearsal room company not found");
  return data.company_id;
}

/** Look up company_id from a city_studios (recording studio) row */
export async function getCompanyIdFromRecordingStudio(studioId: string): Promise<string> {
  const { data, error } = await supabase
    .from("city_studios")
    .select("company_id")
    .or(`id.eq.${studioId},company_id.eq.${studioId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data?.company_id) throw new Error("Recording studio company not found");
  return data.company_id;
}

/** Look up company_id from a labels row */
export async function getCompanyIdFromLabel(labelId: string): Promise<string> {
  const { data, error } = await supabase
    .from("labels")
    .select("company_id")
    .or(`id.eq.${labelId},company_id.eq.${labelId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data?.company_id) throw new Error("Label company not found");
  return data.company_id;
}

/** Standard query keys to invalidate after any company balance change */
export const COMPANY_BALANCE_QUERY_KEYS = ["companies", "company-balance", "company-transactions"];
