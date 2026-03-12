import { supabase } from "@/integrations/supabase/client";

/**
 * Deducts an amount from a company's balance and records a transaction.
 * Throws if insufficient funds.
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
  // Fetch current balance
  const { data: company, error: fetchError } = await supabase
    .from("companies")
    .select("balance")
    .eq("id", companyId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch company: ${fetchError.message}`);
  if (!company) throw new Error("Company not found");

  if ((company.balance || 0) < amount) {
    throw new Error(`Insufficient funds. Need $${amount.toLocaleString()} but only have $${(company.balance || 0).toLocaleString()}`);
  }

  // Deduct balance
  const { error: updateError } = await supabase
    .from("companies")
    .update({ balance: (company.balance || 0) - amount })
    .eq("id", companyId);

  if (updateError) throw new Error(`Failed to update balance: ${updateError.message}`);

  // Record transaction
  const { error: txError } = await supabase
    .from("company_transactions")
    .insert({
      company_id: companyId,
      transaction_type: "expense",
      amount: -amount,
      description,
      category,
    });

  if (txError) console.error("Failed to record transaction:", txError);
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
