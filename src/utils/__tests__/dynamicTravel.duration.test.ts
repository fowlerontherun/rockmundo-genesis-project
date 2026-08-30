import { describe, expect, it } from "vitest";
import {
  calculateDuration,
  reduceTravelDurationHours,
} from "@/utils/dynamicTravel";

describe("travel duration reduction", () => {
  it("removes thirty minutes and preserves half-hour minimums", () => {
    expect(reduceTravelDurationHours(4)).toBe(3.5);
    expect(reduceTravelDurationHours(0.6)).toBe(0.5);
  });

  it("applies to normal and premium travel options", () => {
    expect(calculateDuration(56, "bus")).toBe(0.7);
    expect(calculateDuration(1000, "private_jet")).toBe(2.2);
  });
});
