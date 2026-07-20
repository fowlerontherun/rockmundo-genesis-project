import { describe, expect, it } from "vitest";
import { canonicalSection } from "./FestivalOwnerConsole";

describe("FestivalOwnerConsole section compatibility", () => {
  it("maps legacy live hash to operations", () => {
    expect(canonicalSection("live")).toBe("operations");
  });

  it("keeps legacy booking hash on lineup", () => {
    expect(canonicalSection("booking")).toBe("lineup");
  });
});
