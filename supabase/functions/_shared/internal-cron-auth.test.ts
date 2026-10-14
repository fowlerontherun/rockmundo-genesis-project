import { describe, expect, it, vi } from "vitest";
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
});
