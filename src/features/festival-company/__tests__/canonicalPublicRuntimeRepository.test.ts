import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { festivalRuntimeRepository, mapFestivalRuntimeError } from "../data/festivalRuntimeRepository";
import { parseFestivalPublicLiveStatus } from "../domain/festivalRuntime";

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

  it("fetches only the canonical public RPC using the published slug", async () => {
    rpc.mockResolvedValue({ data: result, error: null });
    const response = await festivalRuntimeRepository.publicExperience("sample-festival");
    expect(rpc).toHaveBeenCalledWith("get_public_festival_edition_live_status", { p_slug: "sample-festival" });
    expect(response).toEqual(result);
  });

  it("supports the existing read-only live status parser without inventing performances or crowd sizes", () => {
    const parsed = parseFestivalPublicLiveStatus(result);
    expect(parsed.festivalLaunchId).toBe(launchId);
    expect(parsed.runtimeStatus).toBe("runtime_complete");
    expect(parsed.currentDay).toBeNull();
    expect(parsed.attendanceBand).toBeNull();
    expect(parsed.performances).toEqual([]);
  });

  it("maps an undeployed canonical RPC to an unavailable state instead of repeated polling", () => {
    const error = mapFestivalRuntimeError(
      "Could not find the function public.get_public_festival_edition_live_status(p_slug) in the schema cache",
      "PGRST202",
    );
    expect(error.message).toBe("festival_public_runtime_not_deployed");
  });

  it("does not expose unverified values when the canonical projection is absent", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const response = await festivalRuntimeRepository.publicExperience("no-public-festival");
    expect(response).toBeNull();
    expect(() => parseFestivalPublicLiveStatus(response)).toThrow("malformed_festival_runtime");
  });
});
