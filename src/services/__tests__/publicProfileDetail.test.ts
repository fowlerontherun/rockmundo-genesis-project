import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const maybeSingle = vi.fn();
const rpc = vi.fn(() => ({ maybeSingle }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { getPublicProfileDetail, __publicProfileDetailTestUtils } = await import("../publicProfileDetail");

const targetProfileId = "33333333-3333-4333-8333-333333333333";
const viewerProfileId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockReturnValue({ maybeSingle });
});

describe("public profile detail service", () => {
  it("validates target and viewer ids before backend reads", () => {
    expect(__publicProfileDetailTestUtils.validatePublicProfileDetailInput(` ${targetProfileId} `, viewerProfileId)).toEqual({
      target_profile_id: targetProfileId,
      viewer_profile_id: viewerProfileId,
    });
  });

  it("rejects invalid target profile ids", async () => {
    await expect(getPublicProfileDetail("not-a-profile", viewerProfileId)).rejects.toThrow("valid player profile");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid viewer profile ids", async () => {
    await expect(getPublicProfileDetail(targetProfileId, "bad-viewer")).rejects.toThrow("valid player profile");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("loads a public-safe detail row through the guarded RPC", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        profile_id: targetProfileId,
        user_id: "11111111-1111-4111-8111-111111111111",
        username: "jo",
        display_name: "Jo Star",
        avatar_url: null,
        bio: "Guitarist",
        fame: null,
        fans: null,
        level: null,
        city_name: null,
        created_at: "2026-01-01T00:00:00Z",
        bands: null,
      },
      error: null,
    });

    await expect(getPublicProfileDetail(targetProfileId, viewerProfileId)).resolves.toEqual(
      expect.objectContaining({ id: targetProfileId, username: "jo", fame: 0, fans: 0, level: 1, bands: [] }),
    );
    expect(rpc).toHaveBeenCalledWith("get_public_profile_detail", { target_profile_id: targetProfileId, viewer_profile_id: viewerProfileId });
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("maps blocked or private backend failures to a generic unavailable error", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Profile is blocked or private" } });
    await expect(getPublicProfileDetail(targetProfileId, viewerProfileId)).rejects.toThrow("not available");
  });

  it("maps empty RPC responses to a not found error", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPublicProfileDetail(targetProfileId, viewerProfileId)).rejects.toThrow("not found");
  });
});
