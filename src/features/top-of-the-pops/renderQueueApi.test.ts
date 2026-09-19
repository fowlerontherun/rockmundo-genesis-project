import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ totpRpc: rpc }));

import {
  activeTotpRenderJob,
  cancelTotpRender,
  enqueueTotpRender,
  getTotpRenderJobs,
  latestSucceededTotpRender,
  totpRenderStateLabel,
  type TotpRenderJob,
} from "./renderQueueApi";
import type { TotpEpisodeManifest } from "./episodeManifest";

const manifest = {
  manifest_version: 1,
  episode_id: "episode-1",
  episode_number: 3,
  episode_date: "2026-09-19",
  broadcast_at: "2026-09-19T19:00:00.000Z",
  check_in_at: "2026-09-19T18:00:00.000Z",
  presenter_key: "alex_rayne",
  show_variant: null,
  broadcast_profile: "standard",
  programme_spec: {
    width: 1920,
    height: 1080,
    frame_rate: 30,
    video_codec: "h264",
    audio_codec: "aac",
    audio_channels: 2,
    aspect_ratio: "16:9",
  },
  segments: [],
  total_runtime_ms: 0,
  production_state: "production_ready",
  checksum: "check-1",
} as unknown as TotpEpisodeManifest;

const job = (overrides: Partial<TotpRenderJob>): TotpRenderJob => ({
  id: "job-1",
  episode_id: "episode-1",
  manifest_checksum: "check-1",
  state: "queued",
  attempts: 0,
  plan: {} as TotpRenderJob["plan"],
  artifacts: [],
  qc: {},
  error_message: null,
  requested_by: null,
  claimed_at: null,
  finished_at: null,
  created_at: "2026-09-19T10:00:00Z",
  updated_at: "2026-09-19T10:00:00Z",
  progress_percent: 0,
  progress_stage: null,
  worker_id: null,
  heartbeat_at: null,
  max_attempts: 3,
  output_metadata: {},
  ...overrides,
});

describe("Top of the Pops render queue api", () => {
  beforeEach(() => rpc.mockReset());

  it("queues a render with the deterministic plan and the running-sheet fingerprint", async () => {
    rpc.mockResolvedValue({
      data: { id: "job-9", episode_id: "episode-1", state: "queued", manifest_checksum: "check-1" },
      error: null,
    });
    const queued = await enqueueTotpRender(manifest);
    expect(rpc).toHaveBeenCalledWith("totp_admin_enqueue_render", expect.objectContaining({
      p_episode_id: "episode-1",
      p_manifest_checksum: "check-1",
    }));
    const args = rpc.mock.calls[0][1] as { p_plan: { delivery: { master: string } } };
    expect(args.p_plan.delivery.master).toBe("totp-episode-003-2026-09-19-master.mp4");
    expect(queued.id).toBe("job-9");
  });

  it("lists jobs and tolerates an empty data response", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await getTotpRenderJobs("episode-1")).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("totp_episode_render_jobs", { p_episode_id: "episode-1" });
  });

  it("surfaces RPC failures instead of silently returning no jobs", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Admin access required" } });
    await expect(getTotpRenderJobs("episode-1")).rejects.toThrow("Admin access required");
  });

  it("cancels a job and unwraps a single-row response", async () => {
    rpc.mockResolvedValue({ data: [{ id: "job-1", state: "cancelled" }], error: null });
    expect((await cancelTotpRender("job-1")).state).toBe("cancelled");
  });

  it("rejects empty mutation responses", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(enqueueTotpRender(manifest)).rejects.toThrow("returned no render job");
    await expect(cancelTotpRender("job-1")).rejects.toThrow("returned no cancelled render job");
  });

  it("finds the active job and the latest matching master", () => {
    const jobs = [job({ id: "a", state: "rendering" }), job({ id: "b", state: "succeeded" }), job({ id: "c", state: "succeeded", manifest_checksum: "old" })];
    expect(activeTotpRenderJob(jobs)?.id).toBe("a");
    expect(latestSucceededTotpRender(jobs, "check-1")?.id).toBe("b");
    expect(latestSucceededTotpRender(jobs, "missing")).toBeNull();
  });

  it("describes each state in plain words", () => {
    expect(totpRenderStateLabel("rendering")).toBe("Rendering now");
    expect(totpRenderStateLabel("succeeded")).toBe("Ready to publish");
  });
});
