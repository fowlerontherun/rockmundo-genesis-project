import { describe, expect, it, vi } from "vitest";
import {
  getFestivalBookingMode,
  warnIfCanonicalUsesLegacyMutation,
} from "../mode";

describe("festival booking mode branching", () => {
  it("routes canonical editions before legacy compatibility", () => {
    expect(
      getFestivalBookingMode({ editionId: "edition", legacyId: "legacy" }),
    ).toBe("canonical");
    expect(getFestivalBookingMode({ legacyId: "legacy" })).toBe("legacy");
    expect(getFestivalBookingMode({})).toBe("unavailable");
  });

  it("warns when canonical editions hit legacy mutations in development", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warnIfCanonicalUsesLegacyMutation("apply", "edition-1");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("edition-1"));
    spy.mockRestore();
  });
});
