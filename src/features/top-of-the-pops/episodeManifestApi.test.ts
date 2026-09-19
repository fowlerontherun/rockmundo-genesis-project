import { beforeEach, describe, expect, it, vi } from "vitest";

const totpRpc = vi.fn();
const getTotpPerformanceAudio = vi.fn();
const listPresenterMedia = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ list: (...args: unknown[]) => listPresenterMedia(...args) }) } },
}));
vi.mock("./rpc", () => ({ totpRpc: (...args: unknown[]) => totpRpc(...args) }));
vi.mock("./api", () => ({
  getTotpPerformanceAudio: (...args: unknown[]) => getTotpPerformanceAudio(...args),
}));
vi.mock("./totpMedia", () => ({
  TOTP_MEDIA_BUCKET: "totp-media",
  TOTP_MEDIA_PATHS: { presenter: (key: string, slot: string) => `presenters/${key}/${slot}` },
  totpMediaPublicUrl: (path: string) => `https://media.example/${path}`,
}));

import {
  buildTotpEpisodeManifestFromEpisode,
  getStoredTotpEpisodeManifest,
  inGameTrackRights,
  saveTotpEpisodeManifest,
  storedManifestMatchesLive,
} from "./episodeManifestApi";
import type { TotpEpisode } from "./api";

const episode: TotpEpisode = {
  id: "11111111-1111-4111-8111-111111111111",
  episode_number: 5,
  episode_date: "2026-09-19",
  status: "locked",
  check_in_at: "2026-09-19T18:00:00Z",
  broadcast_at: "2026-09-19T19:00:00Z",
  presenter_key: "presenter_a",
  broadcast_profile: "standard",
  performances: [
    {
      performance_id: "p1",
      running_order: 1,
      band_id: "b1",
      band_name: "The Kestrels",
      song_id: "s1",
      song_title: "Opening Night",
      stage_key: "main_stage",
      presenter_intro: "Welcome!",
      qualifying_rank: 1,
    },
  ],
};

beforeEach(() => {
  totpRpc.mockReset();
  getTotpPerformanceAudio.mockReset();
  listPresenterMedia.mockReset();
  listPresenterMedia.mockResolvedValue({ data: [{ name: "act-intro" }], error: null });
});

describe("TOTP stored running sheet", () => {
  it("builds a manifest from live performance audio with cleared in-game rights", async () => {
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest, issues } = await buildTotpEpisodeManifestFromEpisode(episode);

    expect(manifest.segments).toHaveLength(1);
    expect(manifest.total_runtime_ms).toBe(190_000);
    expect(manifest.segments[0].rights.status).toBe("cleared");
    expect(manifest.segments[0].assets).toContainEqual({
      kind: "presenter_audio",
      url: "https://media.example/presenters/presenter_a/act-intro",
      duration_ms: 8_000,
    });
    expect(issues).toEqual([]);
    expect(inGameTrackRights().youtube_live_permitted).toBe(true);
  });

  it("reports a blocking issue when recorded presenter media is missing", async () => {
    listPresenterMedia.mockResolvedValue({ data: [], error: null });
    getTotpPerformanceAudio.mockResolvedValue({ audio_url: "https://cdn/p1.mp3", audio_generation_status: "complete", duration_seconds: 182 });
    const { issues } = await buildTotpEpisodeManifestFromEpisode(episode);
    expect(issues.map((issue) => issue.code)).toContain("missing_presenter_audio");
  });

  it("reports blocking issues when a performance has no audio", async () => {
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: null,
      audio_generation_status: "pending",
      duration_seconds: null,
    });

    const { issues } = await buildTotpEpisodeManifestFromEpisode(episode);
    expect(issues.map((issue) => issue.code)).toContain("missing_song_audio");
  });

  it("reads the stored running sheet", async () => {
    totpRpc.mockResolvedValue({ data: { episode_id: episode.id, checksum: "abc" }, error: null });
    const stored = await getStoredTotpEpisodeManifest(episode.id);
    expect(totpRpc).toHaveBeenCalledWith("totp_episode_manifest", { p_episode_id: episode.id });
    expect(stored?.checksum).toBe("abc");
  });

  it("saves the running sheet with the requested production state", async () => {
    totpRpc.mockResolvedValue({ data: { episode_id: episode.id, checksum: "abc" }, error: null });
    getTotpPerformanceAudio.mockResolvedValue({ audio_url: "u", audio_generation_status: "complete", duration_seconds: 100 });
    const { manifest } = await buildTotpEpisodeManifestFromEpisode(episode);

    await saveTotpEpisodeManifest({ episodeId: episode.id, manifest, productionState: "production_ready" });

    expect(totpRpc).toHaveBeenCalledWith(
      "totp_admin_save_episode_manifest",
      expect.objectContaining({ p_episode_id: episode.id, p_production_state: "production_ready" }),
    );
  });

  it("surfaces save failures as readable errors", async () => {
    totpRpc.mockResolvedValue({ data: null, error: { message: "Admin access required" } });
    getTotpPerformanceAudio.mockResolvedValue({ audio_url: "u", audio_generation_status: "complete", duration_seconds: 100 });
    const { manifest } = await buildTotpEpisodeManifestFromEpisode(episode);

    await expect(saveTotpEpisodeManifest({ episodeId: episode.id, manifest })).rejects.toThrow(
      "Admin access required",
    );
  });

  it("detects when the stored sheet drifts from the live episode", async () => {
    getTotpPerformanceAudio.mockResolvedValue({ audio_url: "u", audio_generation_status: "complete", duration_seconds: 100 });
    const { manifest } = await buildTotpEpisodeManifestFromEpisode(episode);

    expect(storedManifestMatchesLive(null, manifest)).toBe(false);
    expect(
      storedManifestMatchesLive({ checksum: manifest.checksum } as never, manifest),
    ).toBe(true);
    expect(storedManifestMatchesLive({ checksum: "other" } as never, manifest)).toBe(false);
  });
});
