import { beforeEach, describe, expect, it, vi } from "vitest";

const totpRpc = vi.fn();
const getTotpPerformanceAudio = vi.fn();
const getTotpEpisodePresenterFragments = vi.fn();
const getTotpEpisodePlan = vi.fn();
const getTotpChartRundown = vi.fn();
const totpRemoteAudioDurationMs = vi.fn();
const totpRemoteAudioSha256 = vi.fn();

vi.mock("./rpc", () => ({ totpRpc: (...args: unknown[]) => totpRpc(...args) }));
vi.mock("./api", () => ({
  getTotpPerformanceAudio: (...args: unknown[]) => getTotpPerformanceAudio(...args),
  getTotpEpisodePresenterFragments: (...args: unknown[]) => getTotpEpisodePresenterFragments(...args),
}));
vi.mock("./scheduleApi", () => ({
  getTotpEpisodePlan: (...args: unknown[]) => getTotpEpisodePlan(...args),
}));
vi.mock("./chartRundownApi", () => ({
  getTotpChartRundown: (...args: unknown[]) => getTotpChartRundown(...args),
}));
vi.mock("./audioAsset", () => ({
  totpRemoteAudioDurationMs: (...args: unknown[]) => totpRemoteAudioDurationMs(...args),
  totpRemoteAudioSha256: (...args: unknown[]) => totpRemoteAudioSha256(...args),
}));
vi.mock("./totpMedia", () => ({
  totpMediaPublicUrl: (path: string) => `https://media.example/${path}`,
}));

import {
  buildTotpEpisodeManifestFromEpisode,
  getStoredTotpEpisodeManifest,
  saveTotpEpisodeManifest,
  storedManifestMatchesLive,
  unverifiedTrackRights,
} from "./episodeManifestApi";
import { canonicalise, manifestChecksum } from "./episodeManifest";
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

function clearedPlan() {
  return {
    episode_id: episode.id,
    theme: null,
    opening_link: null,
    closing_link: null,
    segments: [],
    notes: null,
    broadcast_rights: {
      s1: {
        owner: "Example Master Owner",
        licence: "broadcast-agreement-1",
        territories: ["WORLD"],
        expires_on: null,
        content_id_allowlisted: true,
        youtube_live_permitted: true,
        status: "cleared",
      },
    },
    presenter_audio: {
      p1: {
        performance_id: "p1",
        presenter_key: "presenter_a",
        script_text: "Welcome!",
        script_checksum: manifestChecksum(canonicalise("Welcome!")),
        audio_url: "https://cdn/presenter-p1.wav",
        duration_ms: 2_400,
        sha256: "a".repeat(64),
        version: 1,
        uploaded_at: "2026-09-19T10:00:00Z",
      },
    },
  };
}

beforeEach(() => {
  totpRpc.mockReset();
  getTotpPerformanceAudio.mockReset();
  getTotpEpisodePresenterFragments.mockReset();
  getTotpEpisodePlan.mockReset();
  getTotpChartRundown.mockReset();
  totpRemoteAudioDurationMs.mockReset();
  totpRemoteAudioSha256.mockReset();
  getTotpEpisodePlan.mockResolvedValue(clearedPlan());
  getTotpChartRundown.mockResolvedValue({ episode_id: episode.id, chart_snapshot_date: "2026-09-19", streaming: [], digital_sales: [], streaming_count: 0, digital_sales_count: 0 });
  getTotpEpisodePresenterFragments.mockResolvedValue({ presenter_key: "presenter_a", phrases: {}, bands: {} });
  totpRemoteAudioDurationMs.mockResolvedValue(1_350);
  totpRemoteAudioSha256.mockResolvedValue("e".repeat(64));
});

describe("TOTP stored running sheet", () => {
  it("builds a manifest from explicit rights and versioned presenter audio", async () => {
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest, issues } = await buildTotpEpisodeManifestFromEpisode(episode);

    expect(manifest.segments).toHaveLength(1);
    expect(manifest.total_runtime_ms).toBe(184_400);
    expect(manifest.segments[0].rights.status).toBe("cleared");
    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio")?.sha256).toBe("a".repeat(64));
    expect(issues).toEqual([]);
  });

  it("freezes a reusable phrase and matching band-name take when the exact presenter take is missing", async () => {
    const reusableEpisode: TotpEpisode = {
      ...episode,
      performances: [{
        ...episode.performances[0],
        presenter_intro: "And now, it's The Kestrels!",
      }],
    };
    getTotpEpisodePlan.mockResolvedValue({
      ...clearedPlan(),
      presenter_audio: {},
    });
    getTotpEpisodePresenterFragments.mockResolvedValue({
      presenter_key: "presenter_a",
      phrases: {
        "and-now-its": {
          storage_path: `presenters/presenter_a/reusable-phrases/and-now-its-${"c".repeat(64)}.webm`,
          uploaded_at: "2026-09-21T12:00:00Z",
        },
      },
      bands: {
        b1: {
          band_id: "b1",
          band_name: "The Kestrels",
          audio_url: "https://media.example/bands/b1.webm",
          duration_ms: 900,
          sha256: "d".repeat(64),
          version: 3,
        },
      },
    });
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest, issues } = await buildTotpEpisodeManifestFromEpisode(reusableEpisode);

    const sequence = manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio_sequence");
    expect(sequence?.duration_ms).toBe(2_315);
    expect(sequence?.gap_ms).toBe(65);
    expect(sequence?.fragments).toEqual([
      expect.objectContaining({ role: "phrase", duration_ms: 1_350, sha256: "c".repeat(64) }),
      expect.objectContaining({ role: "band_name", duration_ms: 900, sha256: "d".repeat(64), version: 3 }),
    ]);
    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio")).toBeUndefined();
    expect(issues).toEqual([]);
  });

  it("remotely hashes legacy reusable phrase files with truncated digest filenames", async () => {
    const reusableEpisode: TotpEpisode = {
      ...episode,
      performances: [{
        ...episode.performances[0],
        presenter_intro: "And now, it's The Kestrels!",
      }],
    };
    getTotpEpisodePlan.mockResolvedValue({ ...clearedPlan(), presenter_audio: {} });
    getTotpEpisodePresenterFragments.mockResolvedValue({
      presenter_key: "presenter_a",
      phrases: {
        "and-now-its": {
          storage_path: `presenters/presenter_a/reusable-phrases/and-now-its-${"c".repeat(16)}.webm`,
          uploaded_at: "2026-09-21T11:00:00Z",
        },
      },
      bands: {
        b1: {
          band_id: "b1",
          band_name: "The Kestrels",
          audio_url: "https://media.example/bands/b1.webm",
          duration_ms: 900,
          sha256: "d".repeat(64),
          version: 3,
        },
      },
    });
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest, issues } = await buildTotpEpisodeManifestFromEpisode(reusableEpisode);

    expect(totpRemoteAudioSha256).toHaveBeenCalledOnce();
    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio_sequence")?.fragments?.[0].sha256).toBe("e".repeat(64));
    expect(issues).toEqual([]);
  });

  it("prefers an exact current presenter take over reusable fragments", async () => {
    getTotpEpisodePresenterFragments.mockResolvedValue({
      presenter_key: "presenter_a",
      phrases: {
        "please-welcome": {
          storage_path: `presenters/presenter_a/reusable-phrases/please-welcome-${"c".repeat(64)}.webm`,
          uploaded_at: "2026-09-21T12:00:00Z",
        },
      },
      bands: {
        b1: {
          band_id: "b1",
          band_name: "The Kestrels",
          audio_url: "https://media.example/bands/b1.webm",
          duration_ms: 900,
          sha256: "d".repeat(64),
          version: 3,
        },
      },
    });
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest } = await buildTotpEpisodeManifestFromEpisode(episode);

    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio")?.url).toBe("https://cdn/presenter-p1.wav");
    expect(manifest.segments[0].assets.find((asset) => asset.kind === "presenter_audio_sequence")).toBeUndefined();
    expect(totpRemoteAudioDurationMs).not.toHaveBeenCalled();
  });

  it("does not auto-clear a track with no rights record", async () => {
    getTotpEpisodePlan.mockResolvedValue({ ...clearedPlan(), broadcast_rights: {} });
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { manifest, issues } = await buildTotpEpisodeManifestFromEpisode(episode);
    expect(manifest.segments[0].rights).toEqual(unverifiedTrackRights());
    expect(issues.map((issue) => issue.code)).toContain("rights_not_cleared");
  });

  it("blocks a nominally cleared track until Content ID and YouTube permission are confirmed", async () => {
    const plan = clearedPlan();
    plan.broadcast_rights.s1.content_id_allowlisted = false;
    plan.broadcast_rights.s1.youtube_live_permitted = false;
    getTotpEpisodePlan.mockResolvedValue(plan);
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { issues } = await buildTotpEpisodeManifestFromEpisode(episode);
    expect(issues.map((issue) => issue.code)).toContain("content_id_not_allowlisted");
    expect(issues.map((issue) => issue.code)).toContain("youtube_not_permitted");
  });

  it("blocks stale presenter audio when the script has changed", async () => {
    const plan = clearedPlan();
    plan.presenter_audio.p1.script_checksum = "old-script";
    getTotpEpisodePlan.mockResolvedValue(plan);
    getTotpPerformanceAudio.mockResolvedValue({
      audio_url: "https://cdn/p1.mp3",
      audio_generation_status: "complete",
      duration_seconds: 182,
    });

    const { issues } = await buildTotpEpisodeManifestFromEpisode(episode);
    expect(issues.map((issue) => issue.code)).toContain("missing_presenter_audio");
  });

  it("reports blocking issues when a performance has no song audio", async () => {
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
    expect(storedManifestMatchesLive({ checksum: manifest.checksum } as never, manifest)).toBe(true);
    expect(storedManifestMatchesLive({ checksum: "other" } as never, manifest)).toBe(false);
  });
});
