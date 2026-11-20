import { describe, it, expect } from "vitest";
import { isChristmasSeason } from "./christmas";

describe("isChristmasSeason", () => {
  it("is on during December", () => expect(isChristmasSeason(new Date("2026-12-25T12:00:00Z"))).toBe(true));
  it("switches off from 7 January", () => expect(isChristmasSeason(new Date("2027-01-07T00:00:00Z"))).toBe(false));
  it("is off when the master switch is disabled", () => expect(isChristmasSeason(new Date("2026-12-25T12:00:00Z"), false)).toBe(false));
});
