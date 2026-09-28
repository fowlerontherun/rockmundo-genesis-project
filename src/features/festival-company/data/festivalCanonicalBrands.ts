import { supabase } from "@/integrations/supabase/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface FestivalCanonicalBrandCandidate {
  brandId: string;
  brandName: string;
  logoUrl: string | null;
  category: string;
  region: string | null;
  availableBudget: number;
  wealthScore: number;
  exclusivityPref: boolean;
  alreadyProspected: boolean;
  alreadyContracted: boolean;
}

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

export async function getFestivalCanonicalBrandCandidates(
  festivalCompanyId: string, search = "", limit = 40,
): Promise<FestivalCanonicalBrandCandidate[]> {
  if (!UUID.test(festivalCompanyId)) throw new Error("festival_sponsorship_forbidden");
  const { data, error } = await rpc("get_festival_canonical_brand_candidates", {
    p_festival_company_id: festivalCompanyId,
    p_search: search.trim().slice(0, 100),
    p_limit: Math.min(100, Math.max(1, Math.trunc(limit))),
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("festival_brand_candidates_invalid");
  return data.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("festival_brand_candidates_invalid");
    const b = row as Record<string, unknown>;
    if (typeof b.brand_id !== "string" || !UUID.test(b.brand_id)
      || typeof b.brand_name !== "string" || typeof b.category !== "string") {
      throw new Error("festival_brand_candidates_invalid");
    }
    return {
      brandId: b.brand_id, brandName: b.brand_name,
      logoUrl: typeof b.logo_url === "string" ? b.logo_url : null,
      category: b.category, region: typeof b.region === "string" ? b.region : null,
      availableBudget: Number(b.available_budget ?? 0),
      wealthScore: Number(b.wealth_score ?? 0),
      exclusivityPref: b.exclusivity_pref === true,
      alreadyProspected: b.already_prospected === true,
      alreadyContracted: b.already_contracted === true,
    };
  });
}

export async function addFestivalCanonicalBrandProspect(festivalCompanyId: string, brandId: string) {
  if (!UUID.test(festivalCompanyId) || !UUID.test(brandId)) throw new Error("festival_sponsorship_forbidden");
  const { data, error } = await rpc("add_festival_canonical_brand_prospect", {
    p_festival_company_id: festivalCompanyId,
    p_brand_id: brandId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("festival_brand_prospect_invalid");
  return data;
}
