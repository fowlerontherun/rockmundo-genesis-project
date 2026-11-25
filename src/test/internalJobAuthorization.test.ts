import { describe, expect, it, vi } from "vitest";
import {
  authorizeInternalJob,
  verifyInternalCronRequest,
} from "../../supabase/functions/_shared/trusted-scheduler";
import { requireGigOfferSources } from "../../supabase/functions/generate-gig-offers/gigOfferPrerequisites";

const headers = { "Access-Control-Allow-Origin": "*" };
const request = (method = "POST", secret?: string) =>
  new Request("https://example.test/functions/v1/university-attendance", {
    method,
    headers: secret ? { "x-cron-secret": secret } : {},
  });

describe("shared internal scheduler authentication (#4228, #4255)", () => {
  it("denies GET and missing credentials before the privileged verifier", async () => {
    const rpc = vi.fn();
    expect((await verifyInternalCronRequest(request("GET"), { rpc }, headers))?.status).toBe(405);
    expect((await verifyInternalCronRequest(request(), { rpc }, headers))?.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a forged job origin, bearer-only request and oversized cron header without privileged reads", async () => {
    const rpc = vi.fn();
    const spoof = new Request("https://example.test/functions/v1/generate-gig-offers", {
      method: "POST",
      headers: { authorization: "Bearer forged", "x-triggered-by": "pg_cron", "x-request-id": "internal" },
    });
    const oversized = request("POST", "a".repeat(4_097));
    expect((await authorizeInternalJob(spoof, { rpc }, "generate-gig-offers", headers))?.status).toBe(401);
    expect((await authorizeInternalJob(oversized, { rpc }, "generate-gig-offers", headers))?.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed for invalid, errored, or thrown verification", async () => {
    const invalid = vi.fn().mockResolvedValue({ data: false, error: null });
    expect((await verifyInternalCronRequest(request("POST", "wrong"), { rpc: invalid }, headers))?.status).toBe(401);
    expect(invalid).toHaveBeenCalledWith("verify_internal_cron_secret", { p_secret: "wrong" });

    const errored = vi.fn().mockResolvedValue({ data: null, error: new Error("unavailable") });
    expect((await verifyInternalCronRequest(request("POST", "secret"), { rpc: errored }, headers))?.status).toBe(401);
    const thrown = vi.fn().mockRejectedValue(new Error("connection failed"));
    expect((await verifyInternalCronRequest(request("POST", "secret"), { rpc: thrown }, headers))?.status).toBe(401);
  });

  it("allows a verified university scheduler without claiming a six-worker window", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await verifyInternalCronRequest(request("POST", "secret"), { rpc }, headers)).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("claims the lifecycle window only after secret verification; denies duplicates", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { claimed: true }, error: null });
    expect(await authorizeInternalJob(request("POST", "secret"), { rpc }, "generate-gig-offers", headers)).toBeNull();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "verify_internal_cron_secret", "claim_privileged_job_window",
    ]);

    const duplicate = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { claimed: false }, error: null });
    const result = await authorizeInternalJob(request("POST", "secret"), { rpc: duplicate }, "generate-gig-offers", headers);
    expect(result?.status).toBe(200);
    expect(await result?.json()).toMatchObject({ skipped: true, reason: "already_claimed" });
  });

  it("fails closed if the window claim RPC errors or rejects", async () => {
    const errored = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("down") });
    expect((await authorizeInternalJob(request("POST", "secret"), { rpc: errored }, "generate-gig-offers", headers))?.status).toBe(503);
    const thrown = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockRejectedValueOnce(new Error("network"));
    expect((await authorizeInternalJob(request("POST", "secret"), { rpc: thrown }, "generate-gig-offers", headers))?.status).toBe(503);
  });

  it("authorizes only one of two simultaneous requests for the same claimed job window", async () => {
    let claims = 0;
    const rpc = vi.fn(async (name: string) => name === "verify_internal_cron_secret"
      ? { data: true, error: null }
      : { data: { claimed: ++claims === 1 }, error: null });
    const responses = await Promise.all([
      authorizeInternalJob(request("POST", "secret"), { rpc }, "generate-gig-offers", headers),
      authorizeInternalJob(request("POST", "secret"), { rpc }, "generate-gig-offers", headers),
    ]);
    expect(responses.filter((response) => response === null)).toHaveLength(1);
    expect(responses.filter((response) => response?.status === 200)).toHaveLength(1);
    expect(rpc.mock.calls.filter(([name]) => name === "claim_privileged_job_window")).toHaveLength(2);
  });
});

describe("global gig-offer prerequisite safety (#4255)", () => {
  it("refuses to fabricate offers when there are no active promoters or venues", () => {
    expect(() => requireGigOfferSources([], [{ id: "venue" }])).toThrow("no_active_gig_promoters");
    expect(() => requireGigOfferSources(null, [{ id: "venue" }])).toThrow("no_active_gig_promoters");
    expect(() => requireGigOfferSources([{ id: "promoter" }], [])).toThrow("no_available_gig_venues");
  });

  it("preserves the verified source identities", () => {
    const promoters = [{ id: "promoter" }];
    const venues = [{ id: "venue" }];
    expect(requireGigOfferSources(promoters, venues)).toEqual({ promoters, venues });
  });
});
