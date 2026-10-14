import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { authorizeInternalCronRequest } from "./internal-cron-auth";

function request(secret?: string, bearer?: string): Pick<Request, "headers"> {
  const headers = new Headers();
  if (secret !== undefined) headers.set("x-cron-secret", secret);
  if (bearer !== undefined) headers.set("authorization", bearer);
  return { headers };
}

describe("privileged cron authentication", () => {
  it("rejects missing, short and JWT-only credentials without touching database", async () => {
    const verify = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await authorizeInternalCronRequest(request(), verify)).toBe("unauthorized");
    expect(await authorizeInternalCronRequest(request("too-short"), verify)).toBe("unauthorized");
    expect(await authorizeInternalCronRequest(request(undefined, "Bearer example"), verify)).toBe("unauthorized");
    expect(verify).not.toHaveBeenCalled();
  });

  it("only accepts an explicit true response from the secret verifier", async () => {
    const secret = "a".repeat(64);
    expect(await authorizeInternalCronRequest(request(secret), vi.fn().mockResolvedValue({ data: true, error: null }))).toBe("authorized");
    expect(await authorizeInternalCronRequest(request(secret), vi.fn().mockResolvedValue({ data: false, error: null }))).toBe("unauthorized");
    expect(await authorizeInternalCronRequest(request(secret), vi.fn().mockResolvedValue({ data: null, error: null }))).toBe("unauthorized");
  });

  it("fails closed if the database verifier is missing, broken or throws", async () => {
    const req = request("a".repeat(64));
    expect(await authorizeInternalCronRequest(req, vi.fn().mockResolvedValue({ data: true, error: { message: "missing RPC" } }))).toBe("unavailable");
    expect(await authorizeInternalCronRequest(req, vi.fn().mockRejectedValue(new Error("database unavailable")))).toBe("unavailable");
  });
  it("gates all sponsorship job processing behind POST and the cron verifier", () => {
    const worker = readFileSync(new URL("../process-sponsorship-payments/index.ts", import.meta.url), "utf8");
    const authorizeAt = worker.indexOf("await authorizeInternalCronRequest(req");
    expect(authorizeAt).toBeGreaterThan(0);
    expect(worker).toContain("req.method !== 'POST'");
    expect(worker).toContain("x-cron-secret");
    expect(worker).toContain("verify_internal_cron_secret");
    expect(authorizeAt).toBeLessThan(worker.indexOf("const payload = await safeJson"));
    expect(authorizeAt).toBeLessThan(worker.indexOf("runId = await startJobRun"));
    expect(authorizeAt).toBeLessThan(worker.indexOf("process_sponsorship_installment_atomic"));
  });

});
