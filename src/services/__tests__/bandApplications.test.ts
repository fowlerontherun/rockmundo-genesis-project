import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeBandApplicationResponseInput,
  respondBandApplication,
} from "../bandApplications";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/integrations/supabase/client";

const validApplicationId = "44444444-4444-4444-8444-444444444444";
const validBandId = "11111111-1111-4111-8111-111111111111";

describe("band application service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes valid response input and rejects invalid decisions", () => {
    expect(normalizeBandApplicationResponseInput(` ${validApplicationId} `, "approve")).toEqual({
      applicationId: validApplicationId,
      decision: "approve",
    });
    expect(() => normalizeBandApplicationResponseInput(validApplicationId, "accepted" as never)).toThrow("approve or reject");
  });

  it("rejects invalid application IDs before calling the backend", async () => {
    await expect(respondBandApplication("bad-id", "approve")).rejects.toThrow("valid band application");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls guarded response RPC for approval requests", async () => {
    const row = { id: validApplicationId, band_id: validBandId, status: "accepted" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: row, error: null } as never);

    await expect(respondBandApplication(validApplicationId, "approve")).resolves.toBe(row);
    expect(supabase.rpc).toHaveBeenCalledWith("respond_band_application", {
      application_id: validApplicationId,
      decision: "approve",
    });
  });

  it("calls guarded response RPC for rejection requests", async () => {
    const row = { id: validApplicationId, band_id: validBandId, status: "rejected" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: row, error: null } as never);

    await expect(respondBandApplication(validApplicationId, "reject")).resolves.toBe(row);
    expect(supabase.rpc).toHaveBeenCalledWith("respond_band_application", {
      application_id: validApplicationId,
      decision: "reject",
    });
  });

  it("surfaces backend failures", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "This band application is no longer pending." } } as never);

    await expect(respondBandApplication(validApplicationId, "reject")).rejects.toThrow("no longer pending");
  });

  it("rejects empty RPC results", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as never);

    await expect(respondBandApplication(validApplicationId, "approve")).rejects.toThrow("could not be saved");
  });
});
