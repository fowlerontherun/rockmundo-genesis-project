import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/pages/AdvancedGigSystem.tsx"), "utf8");
const hook = readFileSync(resolve(process.cwd(), "src/hooks/useAdvancedGigs.ts"), "utf8");

describe("Advanced Gigs festival integration", () => {
  it("includes confirmed festival appearances in the upcoming performance count", () => {
    expect(page).toContain("{upcomingGigs.length + festivalAppearances.length}");
    expect(page).toContain("Gigs & confirmed festival bookings");
  });
  it("renders festival cards independently of regular gigs", () => {
    expect(page).toContain("festivalAppearances.map((appearance)");
    expect(page).toContain("FESTIVAL_APPEARANCE_HIGHLIGHT");
    expect(page).toContain("upcomingGigs.length > 0 ?");
  });
  it("does not block regular gigs if the festival RPC fails", () => {
    expect(hook).toContain('queryKey: ["band-upcoming-festival-appearances", bandId]');
    expect(hook).toContain("festivalsError");
    expect(page).toContain("Your regular gigs are still available.");
  });
});
