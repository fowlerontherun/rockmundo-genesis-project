import { describe, expect, it } from "vitest";
import { createStableMutationIdempotencyKey } from "../idempotencyKey";

describe("stable idempotency keys", () => {
  it("builds stable deliberate-action keys when the UUID is retained for retries", () => {
    const first = createStableMutationIdempotencyKey(
      "accept-offer",
      "offer-1",
      "uuid-1",
    );
    const retry = createStableMutationIdempotencyKey(
      "accept-offer",
      "offer-1",
      "uuid-1",
    );
    expect(retry).toBe(first);
  });

  it("regenerates only when the action lifecycle asks for a new UUID", () => {
    expect(
      createStableMutationIdempotencyKey("accept-offer", "offer-1", "uuid-2"),
    ).not.toBe(
      createStableMutationIdempotencyKey("accept-offer", "offer-1", "uuid-1"),
    );
  });
});
