import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFestivalCanonicalBrandProspect,
  getFestivalCanonicalBrandDirectory,
} from "./festivalCanonicalBrands";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const COMPANY = "11111111-1111-4111-8111-111111111111";
const BRAND = "22222222-2222-4222-8222-222222222222";

describe("canonical festival sponsorship brand adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the legacy prospect RPC only for a missing edition-aware function", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.add_festival_canonical_brand_prospect(p_brand_id, p_festival_company_id) in the schema cache",
      },
    }).mockResolvedValueOnce({
      data: { id: "33333333-3333-4333-8333-333333333333", sponsorship_brand_id: BRAND },
      error: null,
    });

    await expect(addFestivalCanonicalBrandProspect(COMPANY, BRAND)).resolves.toMatchObject({
      sponsorship_brand_id: BRAND,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "add_festival_canonical_brand_prospect", {
      p_festival_company_id: COMPANY,
      p_brand_id: BRAND,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "add_festival_legacy_brand_prospect", {
      p_festival_company_id: COMPANY,
      p_brand_id: BRAND,
    });
  });

  it("does not bypass ownership or other errors with the fallback", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "festival_sponsorship_forbidden" } });
    await expect(addFestivalCanonicalBrandProspect(COMPANY, BRAND)).rejects.toThrow("festival_sponsorship_forbidden");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("passes first-letter filter and pagination to the database before mapping", async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        brand_id: BRAND, brand_name: "Beta Audio", logo_url: null, category: "Audio", region: "GB",
        available_budget: 1234, wealth_score: 75, exclusivity_pref: false,
        already_prospected: true, already_contracted: false, total_count: 65,
      }],
      error: null,
    });

    await expect(getFestivalCanonicalBrandDirectory(COMPANY, {
      search: " Audio ", initial: "B", sort: "desc", page: 1,
    })).resolves.toMatchObject({
      totalCount: 65,
      items: [{ brandId: BRAND, alreadyProspected: true }],
    });
    expect(rpc).toHaveBeenCalledWith("list_festival_canonical_brands", {
      p_festival_company_id: COMPANY,
      p_search: "Audio",
      p_initial: "B",
      p_sort: "desc",
      p_offset: 40,
      p_limit: 40,
    });
  });
});
