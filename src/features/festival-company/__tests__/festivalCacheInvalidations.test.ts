import { describe, expect, it } from "vitest";
import {
  festivalLaunchInvalidations,
  festivalBookingInvalidations,
} from "../application/festivalCacheInvalidations";

const prefixes = (keys: readonly (readonly string[])[]) => keys.map((key) => key[0]);

describe("festival cache invalidation contract", () => {
  it("refreshes published timetable, ticket sales and owner readiness after launch mutations", () => {
    const keys = prefixes(festivalLaunchInvalidations);
    expect(keys).toContain("public-festival-timetable");
    expect(keys).toContain("public-festival");
    expect(keys).toContain("festival-directory");
    expect(keys).toContain("public-festival-tickets");
    expect(keys).toContain("festival-company-editions");
    expect(keys).toContain("festival-artist-programme");
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("invalidates published lineup and owner views after booking mutations", () => {
    const keys = prefixes(festivalBookingInvalidations);
    expect(keys).toContain("festival-artist-programme");
    expect(keys).toContain("festival-owner-npc-lineup");
    expect(keys).toContain("festival-launch");
    expect(keys).toContain("public-festival");
    expect(keys).toContain("public-festival-timetable");
    expect(keys).toContain("festival-artist-opportunities");
    expect(new Set(keys).size).toBe(keys.length);
  });
});
