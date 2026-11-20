import { describe, expect, it } from "vitest";
import { parseFestivalCapacity, parseFestivalFee } from "./festivalOwnerInputs";

describe("festival owner financial input", () => {
  it("preserves the exact valid fee in minor units", () => {
    expect(parseFestivalFee("19.99")).toBe(1999);
    expect(parseFestivalFee("0")).toBe(0);
  });
  it("rejects invalid fees instead of submitting a previous amount", () => {
    for (const value of ["", "-1", "1.234", "abc", "Infinity"]) expect(parseFestivalFee(value)).toBeNull();
  });
  it("rejects fractional and over-capacity tickets instead of silently clamping", () => {
    expect(parseFestivalCapacity("100", 100)).toBe(100);
    for (const value of ["", "101", "1.5", "-1"]) expect(parseFestivalCapacity(value, 100)).toBeNull();
  });
});