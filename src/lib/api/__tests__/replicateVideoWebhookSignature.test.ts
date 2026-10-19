import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyReplicateWebhookSignature as verify } from
  "../../../../supabase/functions/_shared/replicate-signature";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));
afterAll(() => vi.unstubAllGlobals());

const keyBytes = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 10));
const secret = `whsec_${Buffer.from(keyBytes).toString("base64")}`;
const body = JSON.stringify({ id: "prediction-abc", status: "failed", error: "provider error" });
const nowSeconds = 1_800_000_000;

async function signed(bodyText = body, timestamp = String(nowSeconds), webhookId = "delivery-1") {
  const key = await webcrypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await webcrypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${webhookId}.${timestamp}.${bodyText}`),
  );
  return `v1,${Buffer.from(mac).toString("base64")}`;
}

const input = (signature: string | null, overrides: Record<string, unknown> = {}) => ({
  webhookId: "delivery-1",
  timestamp: String(nowSeconds),
  signature,
  rawBody: body,
  secret,
  nowSeconds,
  ...overrides,
});

describe("Replicate video webhook signature verification (#4240)", () => {
  it("accepts a genuine HMAC-SHA256 signed raw request", async () => {
    expect(await verify(input(await signed()))).toBe(true);
  });

  it("allows a provider's multiple versioned signatures when one v1 is authentic", async () => {
    expect(await verify(input(`v2,AAAA v1,AAAA ${await signed()}`))).toBe(true);
  });

  it("rejects missing ID, timestamp or signature", async () => {
    const sig = await signed();
    expect(await verify(input(null))).toBe(false);
    expect(await verify(input(sig, { webhookId: null }))).toBe(false);
    expect(await verify(input(sig, { timestamp: null }))).toBe(false);
  });

  it("rejects body tampering even when status alone changes", async () => {
    expect(await verify(input(await signed(), {
      rawBody: body.replace('"failed"', '"succeeded"'),
    }))).toBe(false);
  });

  it("rejects mismatched webhook IDs and invalid signatures", async () => {
    expect(await verify(input(await signed(), { webhookId: "delivery-attacker" }))).toBe(false);
    expect(await verify(input("v1,!!!"))).toBe(false);
    expect(await verify(input("v1,AAAA"))).toBe(false);
    expect(await verify(input("v2," + (await signed()).slice(3)))).toBe(false);
  });

  it("rejects timestamps outside the replay window", async () => {
    const old = String(nowSeconds - 301);
    const future = String(nowSeconds + 301);
    expect(await verify(input(await signed(body, old), { timestamp: old }))).toBe(false);
    expect(await verify(input(await signed(body, future), { timestamp: future }))).toBe(false);
    const valid = String(nowSeconds - 300);
    expect(await verify(input(await signed(body, valid), { timestamp: valid }))).toBe(true);
  });

  it("rejects malformed or missing signing keys", async () => {
    expect(await verify(input(await signed(), { secret: "missing-signing-secret" }))).toBe(false);
    expect(await verify(input(await signed(), { secret: "whsec_!" }))).toBe(false);
  });
});
