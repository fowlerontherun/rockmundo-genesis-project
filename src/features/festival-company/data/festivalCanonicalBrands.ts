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

export type FestivalBrandSort = "asc" | "desc";
export interface FestivalCanonicalBrandDirectory {
  items: FestivalCanonicalBrandCandidate[];
  totalCount: number;
}

type RpcError = { message: string; code?: string };
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

function readBrands(data: unknown): FestivalCanonicalBrandCandidate[] {
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

// Retained for other callers and for the later edition-aware migration.
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
  return readBrands(data);
}

// Letter filtering must happen on the server before paging: the catalogue is
// larger than the original candidates RPC's 100-row maximum.
export async function getFestivalCanonicalBrandDirectory(
  festivalCompanyId: string,
  { search = "", initial = "", sort = "asc", page = 0, pageSize = 40 }: {
    search?: string; initial?: string; sort?: FestivalBrandSort; page?: number; pageSize?: number;
  } = {},
): Promise<FestivalCanonicalBrandDirectory> {
  if (!UUID.test(festivalCompanyId)) throw new Error("festival_sponsorship_forbidden");
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const { data, error } = await rpc("list_festival_canonical_brands", {
    p_festival_company_id: festivalCompanyId,
    p_search: search.trim().slice(0, 100),
    p_initial: /^[A-Z]$/.test(initial) ? initial : "",
    p_sort: sort === "desc" ? "desc" : "asc",
    p_offset: Math.max(0, Math.trunc(page)) * safePageSize,
    p_limit: safePageSize,
  });
  if (error) throw new Error(error.message);
  const items = readBrands(data);
  const first = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined;
  const totalCount = first ? Number(first.total_count ?? 0) : 0;
  if (!Number.isFinite(totalCount) || totalCount < 0) throw new Error("festival_brand_candidates_invalid");
  return { items, totalCount };
}

export async function addFestivalCanonicalBrandProspect(festivalCompanyId: string, brandId: string) {
  if (!UUID.test(festivalCompanyId) || !UUID.test(brandId)) throw new Error("festival_sponsorship_forbidden");
  const args = { p_festival_company_id: festivalCompanyId, p_brand_id: brandId };
  let { data, error } = await rpc("add_festival_canonical_brand_prospect", args);
  // The current database predates the edition-aware sponsorship tables. Its
  // compatibility RPC saves real prospects without creating fake contracts.
  if (error && (
    (error.code === "PGRST202" && error.message.includes("add_festival_canonical_brand_prospect"))
    || error.message.includes("Could not find the function public.add_festival_canonical_brand_prospect")
  )) {
    ({ data, error } = await rpc("add_festival_legacy_brand_prospect", args));
  }
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("festival_brand_prospect_invalid");
  return data;
}
