import { describe, expect, it } from "vitest";
import { getFestivalApplicationAvailability } from "../festivalHubState";
import type { PublicFestivalEdition } from "../domainTypes";

const base: PublicFestivalEdition = {
  id: "edition-1",
  title: "Test festival",
  status: "accepting_applications",
  application_open_at: "2026-11-01T09:00:00Z",
  application_close_at: "2026-11-20T09:00:00Z",
};

describe("festival artist application discovery", () => {
  const now = Date.parse("2026-11-18T12:00:00Z");
  it("does not invite application without a selected band", () => {
    expect(getFestivalApplicationAvailability(base, undefined, now).canApply).toBe(false);
  });

  it("hides applications for non-booking editions", () => {
    for (const status of ["live", "completed", "cancelled", "draft"]) {
      expect(getFestivalApplicationAvailability({ ...base, status }, "band-1", now).canApply).toBe(false);
    }
  });

  it("respects opening and closing instants rather than local browser dates", () => {
    expect(getFestivalApplicationAvailability(base, "band-1", Date.parse("2026-11-01T08:59:59Z")).canApply).toBe(false);
    expect(getFestivalApplicationAvailability(base, "band-1", Date.parse(base.application_open_at!)).canApply).toBe(true);
    expect(getFestivalApplicationAvailability(base, "band-1", Date.parse(base.application_close_at!)).canApply).toBe(false);
  });

  it("fails closed on invalid application date metadata", () => {
    expect(getFestivalApplicationAvailability({ ...base, application_close_at: "broken" }, "band-1", now).canApply).toBe(false);
  });

  it("allows a band to start an open application and leaves final authority to the server", () => {
    expect(getFestivalApplicationAvailability(base, "band-1", now)).toEqual({
      canApply: true,
      reason: "Apply to perform.",
    });
  });
});
