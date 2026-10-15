import { afterEach, describe, expect, it, vi } from "vitest";

const makeStore = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("underworld cash purchase network retries", () => {
  it("reuses an unconfirmed request across remounts and reloads", async () => {
    const sessionStorage = makeStore();
    vi.stubGlobal("window", { sessionStorage });
    vi.resetModules();
    const first = await import("@/utils/underworldPurchaseRequest");
    const original = first.getOrCreateUnderworldPurchaseRequestId(
      "profile1", "product1", "cash",
    );
    expect(first.getOrCreateUnderworldPurchaseRequestId(
      "profile1", "product1", "cash",
    )).toBe(original);

    vi.resetModules(); // As if the hook module reloaded.
    const recovered = await import("@/utils/underworldPurchaseRequest");
    expect(recovered.getOrCreateUnderworldPurchaseRequestId(
      "profile1", "product1", "cash",
    )).toBe(original);

    recovered.clearUnderworldPurchaseRequestId("profile1", "product1", "cash");
    expect(recovered.getOrCreateUnderworldPurchaseRequestId(
      "profile1", "product1", "cash",
    )).not.toBe(original);
  });

  it("isolates intended purchases by character, product, and payment method", async () => {
    vi.stubGlobal("window", { sessionStorage: makeStore() });
    vi.resetModules();
    const requests = await import("@/utils/underworldPurchaseRequest");
    const a = requests.getOrCreateUnderworldPurchaseRequestId("a", "p", "cash");
    const b = requests.getOrCreateUnderworldPurchaseRequestId("b", "p", "cash");
    const c = requests.getOrCreateUnderworldPurchaseRequestId("a", "other", "cash");
    const d = requests.getOrCreateUnderworldPurchaseRequestId("a", "p", "crypto");
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
});
