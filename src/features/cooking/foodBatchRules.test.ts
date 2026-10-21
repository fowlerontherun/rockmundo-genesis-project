import { describe, expect, it } from "vitest";
import { calculateBatchExpiry, canConsumePortions, foodAvailability, remainingShelfLifeMs, sortBatchesByExpiry, type FoodBatch } from "./foodBatchRules";

const now = Date.parse("2026-10-21T12:00:00Z");
const batch: FoodBatch = { id: "b1", profileId: "p1", recipeSlug: "apple-pie", portions: 6,
  quality: 85, preparedAt: "2026-10-21T10:00:00Z", expiresAt: "2026-10-22T12:00:00Z" };

describe("perishable cooking batch domain rules", () => {
  it("never gives near-expired ingredients a fresh full shelf life", () => {
    expect(calculateBatchExpiry(batch.preparedAt, 72, [
      { expiresAt: "2026-10-21T16:00:00Z" }, { expiresAt: "2026-10-24T10:00:00Z" },
    ])).toBe("2026-10-21T16:00:00.000Z");
  });
  it("rejects an expired or invalid ingredient and invalid shelf lives", () => {
    expect(calculateBatchExpiry(batch.preparedAt, 72, [{ expiresAt: batch.preparedAt }])).toBeNull();
    expect(calculateBatchExpiry(batch.preparedAt, -1, [{ expiresAt: batch.expiresAt }])).toBeNull();
    expect(calculateBatchExpiry(batch.preparedAt, 72, [])).toBeNull();
  });
  it("treats expiry exactly at its timestamp as unusable", () => {
    expect(foodAvailability(batch, now)).toBe("fresh");
    expect(foodAvailability(batch, Date.parse(batch.expiresAt))).toBe("expired");
    expect(remainingShelfLifeMs(batch, now)).toBe(86_400_000);
  });
  it("prevents empty, fractional, negative, excess or expired consumption", () => {
    expect(canConsumePortions(batch, 2, now)).toBe(true);
    for (const count of [0, -1, 1.5, 7]) expect(canConsumePortions(batch, count, now)).toBe(false);
    expect(canConsumePortions(batch, 1, Date.parse(batch.expiresAt))).toBe(false);
    expect(foodAvailability({ ...batch, portions: 0 }, now)).toBe("empty");
  });
  it("sorts without mutating source batches or altering expiry", () => {
    const later = { ...batch, id: "b2", expiresAt: "2026-10-25T12:00:00Z" };
    const input = [later, batch];
    expect(sortBatchesByExpiry(input).map((item) => item.id)).toEqual(["b1", "b2"]);
    expect(input[0]).toBe(later);
  });
});
