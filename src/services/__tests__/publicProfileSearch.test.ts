import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { searchPublicProfiles, __publicProfileSearchTestUtils } = await import("../publicProfileSearch");

const viewerProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("public profile search service", () => {
  it("validates and normalizes search input before backend reads", () => {
    expect(__publicProfileSearchTestUtils.validatePublicProfileSearchInput("  jo   star  ", viewerProfileId, 100)).toEqual({
      search_term: "jo star",
      viewer_profile_id: viewerProfileId,
      result_limit: 50,
    });
  });

  it("rejects short queries before backend reads", async () => {
    await expect(searchPublicProfiles("j", viewerProfileId)).rejects.toThrow("at least 2");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid viewer profile ids before backend reads", async () => {
    await expect(searchPublicProfiles("jo", "not-a-profile")).rejects.toThrow("valid player");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("searches through the public-safe profile RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ profile_id: viewerProfileId, user_id: "11111111-1111-4111-8111-111111111111", username: "jo", display_name: null, avatar_url: null, bio: null, fame: null, fans: null, level: null, city_name: null, bands: null }],
      error: null,
    });

    await expect(searchPublicProfiles("jo", viewerProfileId)).resolves.toEqual([
      expect.objectContaining({ id: viewerProfileId, username: "jo", fame: 0, fans: 0, level: 1, bands: [] }),
    ]);
    expect(rpc).toHaveBeenCalledWith("search_public_profiles", { search_term: "jo", viewer_profile_id: viewerProfileId, result_limit: 20 });
  });

  it("maps backend failures to friendly errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Authentication required to search player profiles" } });
    await expect(searchPublicProfiles("jo", viewerProfileId)).rejects.toThrow("Sign in");
  });
});
