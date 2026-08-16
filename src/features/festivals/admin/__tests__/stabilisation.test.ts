import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchAdminFestivalCatalogue, mapFestivalError } from "../service";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } }, error: null })) },
  },
}));

const mockPlatformAdmin = () =>
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: true, error: null } as never);

describe("festival admin stabilisation", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
  });

  it("loads admin catalogue rows for brands without editions", async () => {
    mockPlatformAdmin();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ festival_id: "brand-1", brand_name: "Quiet Fields", edition_count: 0, currency_code: null, data_health_warnings: [] }], error: null } as never);
    await expect(fetchAdminFestivalCatalogue()).resolves.toMatchObject([{ festivalId: "brand-1", brandName: "Quiet Fields", editionCount: 0 }]);
  });

  it("rejects malformed catalogue responses with a domain error", async () => {
    mockPlatformAdmin();
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ brand_name: "Broken" }], error: null } as never);
    await expect(fetchAdminFestivalCatalogue()).rejects.toThrow("FESTIVAL_RESPONSE_INVALID");
  });

  it("maps raw permission and migration errors to user-facing codes", () => {
    expect(mapFestivalError({ message: "RLS policy denied" }).code).toBe("FESTIVAL_PERMISSION_DENIED");
    expect(mapFestivalError({ message: "unresolved hybrid legacy stage" }).code).toBe("FESTIVAL_MIGRATION_REQUIRED");
  });
});
