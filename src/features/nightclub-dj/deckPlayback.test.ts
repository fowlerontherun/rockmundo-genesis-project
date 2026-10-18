import { beforeEach, describe, expect, it, vi } from "vitest";

const sign = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: sign }) } },
}));

import { getDjPlaybackUrl, mapAdminDjTrack } from "./library";

const admin = mapAdminDjTrack({
  id: "approved-1", title: "After Hours", artist: "DJ Example", genre: "House",
  bpm: 124, musical_key: "Am", duration_seconds: 240,
  storage_path: "catalog/approved-1/audio.mp3",
  rights_confirmed: true, is_active: true,
});

describe("DJ deck signed playback URL refresh", () => {
  beforeEach(() => sign.mockReset());

  it("requests a new signed URL after an expired playback link is retried", async () => {
    sign.mockResolvedValueOnce({ data: { signedUrl: "https://signed.example/first" }, error: null });
    sign.mockResolvedValueOnce({ data: { signedUrl: "https://signed.example/second" }, error: null });
    expect(await getDjPlaybackUrl(admin)).toBe("https://signed.example/first");
    expect(await getDjPlaybackUrl(admin)).toBe("https://signed.example/second");
    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenCalledWith(admin.storagePath, 3600);
  });

  it("fails closed when the storage service denies a fresh signature", async () => {
    sign.mockResolvedValue({ data: null, error: { message: "Track no longer cleared" } });
    await expect(getDjPlaybackUrl(admin)).rejects.toThrow("Track no longer cleared");
  });

  it("cannot request a signature for a missing source", async () => {
    await expect(getDjPlaybackUrl({ ...admin, storagePath: null })).rejects.toThrow("Audio unavailable");
    expect(sign).not.toHaveBeenCalled();
  });
});
