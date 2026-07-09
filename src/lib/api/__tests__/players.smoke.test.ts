import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");

const { supabase } = await import("@/integrations/supabase/client");
const { ensurePlayerProfile, getPlayerProfileForUser, updatePlayerOnboarding } = await import("@/lib/api/players");

const fromMock = vi.fn();
let query: any;
let result: any;

beforeEach(() => {
  result = { data: null, error: null };
  query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  fromMock.mockReturnValue(query);
  (supabase as any).from = fromMock;
  vi.clearAllMocks();
});

describe("profile loading regressions", () => {
  it("loads a profile by Supabase user id", async () => {
    result.data = { id: "profile-1", user_id: "user-1", username: "ace" };

    await expect(getPlayerProfileForUser("user-1")).resolves.toMatchObject({ id: "profile-1" });

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(query.select).toHaveBeenCalledWith("id, user_id, username, display_name, avatar_url, bio");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.maybeSingle).toHaveBeenCalled();
  });

  it("creates a normalized fallback profile when one does not exist", async () => {
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    query.single.mockResolvedValueOnce({
      data: { id: "profile-2", user_id: "user-2", username: "jane-rocker", display_name: "Jane Rocker" },
      error: null,
    });

    await ensurePlayerProfile({
      id: "user-2",
      email: "Jane Rocker@example.com",
      phone: undefined,
      user_metadata: {},
    } as any);

    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: "user-2", username: "jane-rocker-example-com", display_name: "Jane Rocker@example.com" }),
    ]);
  });

  it("trims onboarding updates and stores empty optional values as null", async () => {
    result.data = { id: "profile-3", display_name: "Nova", avatar_url: null, bio: null };

    await updatePlayerOnboarding("profile-3", { displayName: "  Nova  ", avatarUrl: "   ", bio: "  " });

    expect(query.update).toHaveBeenCalledWith({ display_name: "Nova", avatar_url: null, bio: null });
    expect(query.eq).toHaveBeenCalledWith("id", "profile-3");
  });
});
