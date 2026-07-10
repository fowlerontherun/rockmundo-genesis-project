import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const maybeSingle = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const selectAfterRead = vi.fn(() => ({ eq }));
const selectAfterWrite = vi.fn(() => ({ single }));
const upsert = vi.fn(() => ({ select: selectAfterWrite }));
const from = vi.fn(() => ({ select: selectAfterRead, upsert }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

const {
  fetchOwnSocialPrivacySettings,
  saveOwnSocialPrivacySettings,
  fetchPublicSocialPrivacySettings,
} = await import("../services/socialPrivacySettings");

const dbRow = {
  profile_id: "11111111-1111-4111-8111-111111111111",
  profile_visibility: "public",
  city_visibility: "friends",
  activity_visibility: "private",
  online_status_visibility: "private",
  relationship_visibility: "friends",
  dm_permission: "friends",
  allow_band_invites: true,
  allow_company_invites: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("social privacy settings service", () => {
  it("loads persisted owner settings", async () => {
    maybeSingle.mockResolvedValueOnce({ data: dbRow, error: null });

    await expect(fetchOwnSocialPrivacySettings(dbRow.profile_id)).resolves.toMatchObject({
      profileId: dbRow.profile_id,
      activityVisibility: "private",
      dmPermission: "friends",
      allowCompanyInvites: false,
    });
    expect(from).toHaveBeenCalledWith("profile_privacy_settings");
  });

  it("returns safe defaults for an empty owner row", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(fetchOwnSocialPrivacySettings(dbRow.profile_id)).resolves.toMatchObject({
      onlineStatusVisibility: "private",
      cityVisibility: "friends",
      dmPermission: "friends",
    });
  });

  it("surfaces backend load failures", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: new Error("RLS denied") });

    await expect(fetchOwnSocialPrivacySettings(dbRow.profile_id)).rejects.toThrow("RLS denied");
  });

  it("validates invalid input before saving", async () => {
    await expect(saveOwnSocialPrivacySettings(dbRow.profile_id, {
      profileVisibility: "public",
      cityVisibility: "friends",
      activityVisibility: "friends",
      onlineStatusVisibility: "friends",
      relationshipVisibility: "friends",
      dmPermission: "invalid",
      allowBandInvites: true,
      allowCompanyInvites: true,
    } as any)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves valid settings through idempotent upsert", async () => {
    single.mockResolvedValueOnce({ data: dbRow, error: null });

    await saveOwnSocialPrivacySettings(dbRow.profile_id, {
      profileVisibility: "public",
      cityVisibility: "friends",
      activityVisibility: "private",
      onlineStatusVisibility: "private",
      relationshipVisibility: "friends",
      dmPermission: "friends",
      allowBandInvites: true,
      allowCompanyInvites: false,
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ profile_id: dbRow.profile_id }), { onConflict: "profile_id" });
  });

  it("surfaces backend save failures for unauthorized users", async () => {
    single.mockResolvedValueOnce({ data: null, error: new Error("not owner") });

    await expect(saveOwnSocialPrivacySettings(dbRow.profile_id, {
      profileVisibility: "public",
      cityVisibility: "friends",
      activityVisibility: "friends",
      onlineStatusVisibility: "private",
      relationshipVisibility: "friends",
      dmPermission: "friends",
      allowBandInvites: true,
      allowCompanyInvites: true,
    })).rejects.toThrow("not owner");
  });

  it("loads only public-safe contact preferences for unrelated users", async () => {
    maybeSingle.mockResolvedValueOnce({ data: dbRow, error: null });

    await expect(fetchPublicSocialPrivacySettings(dbRow.profile_id)).resolves.toEqual({
      profileId: dbRow.profile_id,
      profileVisibility: "public",
      dmPermission: "friends",
      allowBandInvites: true,
      allowCompanyInvites: false,
    });
    expect(from).toHaveBeenCalledWith("public_profile_privacy_settings");
  });
});
