import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { festivalRuntimeRepository, mapFestivalRuntimeError } from "../data/festivalRuntimeRepository";
import { parseFestivalPublicLiveStatus } from "../domain/festivalRuntime";
import { parseOptionalFestivalPublicLiveStatus } from "../application/useFestivalRuntime";

const launchId = "123e4567-e89b-42d3-a456-426614174000";
const editionId = "123e4567-e89b-42d3-a456-426614174001";
const result = {
  festivalLaunchId: launchId,
  editionId,
  runtimeStatus: "runtime_complete",
  gatesStatus: "closed",
  currentDay: null,
  attendanceBand: null,
  performances: [],
  messages: [],
  weather: null,
  stageCrowds: [],
};

describe("canonical public edition runtime", () => {
  beforeEach(() => { rpc.mockReset(); });

  it("fetches only the canonical public feed projection using the published slug", async () => {
    rpc.mockResolvedValue({ data: result, error: null });
    const response = await festivalRuntimeRepository.publicExperience("sample-festival");
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_public_festival_edition_live_experience", { p_slug: "sample-festival" });
    expect(response).toEqual(result);
  });

  it("falls back to the canonical status when the additive feed RPC is not deployed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.get_public_festival_edition_live_experience(p_slug)" } })
      .mockResolvedValueOnce({ data: result, error: null });
    expect(await festivalRuntimeRepository.publicExperience("sample-festival")).toEqual({ ...result, feedAvailable: false });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_public_festival_edition_live_status", { p_slug: "sample-festival" });
  });

  it("never falls back on real projection failures or permission denials", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(festivalRuntimeRepository.publicExperience("sample-festival")).rejects.toThrow("permission denied");
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("supports the existing read-only live status parser without inventing performances or crowd sizes", () => {
    const parsed = parseFestivalPublicLiveStatus(result);
    expect(parsed.festivalLaunchId).toBe(launchId);
    expect(parsed.runtimeStatus).toBe("runtime_complete");
    expect(parsed.currentDay).toBeNull();
    expect(parsed.attendanceBand).toBeNull();
    expect(parsed.performances).toEqual([]);
  });

  it("accepts an official live transition without invented scheduled timestamps", () => {
    const item = {
      id: "123e4567-e89b-42d3-a456-426614174099",
      artistName: "Confirmed artist", stageName: "Main Stage",
      scheduledStart: null, scheduledEnd: null,
      status: "live", delayMinutes: 0,
    };
    const parsed = parseFestivalPublicLiveStatus({ ...result, performances: [item] });
    expect(parsed.performances).toEqual([item]);
  });

  it("maps an undeployed canonical RPC to an unavailable state instead of repeated polling", () => {
    const error = mapFestivalRuntimeError(
      "Could not find the function public.get_public_festival_edition_live_status(p_slug) in the schema cache",
      "PGRST202",
    );
    expect(error.message).toBe("festival_public_runtime_not_deployed");
  });

  it("treats a published edition with no runtime as genuinely unavailable", () => {
    expect(parseOptionalFestivalPublicLiveStatus(null)).toBeNull();
    expect(parseOptionalFestivalPublicLiveStatus(undefined)).toBeNull();
    expect(parseOptionalFestivalPublicLiveStatus(result)?.festivalLaunchId).toBe(launchId);
    expect(() => parseOptionalFestivalPublicLiveStatus({ festivalLaunchId: "bad" })).toThrow("malformed_festival_runtime");
  });

    it("does not expose unverified values when the canonical projection is absent", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const response = await festivalRuntimeRepository.publicExperience("no-public-festival");
    expect(response).toBeNull();
    expect(() => parseFestivalPublicLiveStatus(response)).toThrow("malformed_festival_runtime");
  });
});
