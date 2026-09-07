import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical Festival player entry", () => {
  const legacyEntry = source("src/pages/Festivals.tsx");
  const directory = source(
    "src/features/festival-company/ui/PublicFestivalDirectory.tsx",
  );
  const publicPage = source(
    "src/features/festival-company/ui/PublicFestivalPage.tsx",
  );

  it("redirects the old /festivals entry into the canonical public directory", () => {
    expect(legacyEntry).toContain("festivalRoutes.publicDirectory()");
    expect(legacyEntry).toContain("<Navigate replace");
    expect(legacyEntry).not.toContain("FestivalBrowser");
    expect(legacyEntry).not.toContain("game_events");
  });

  it("surfaces performer opportunities and the active character's Festival commitments", () => {
    expect(directory).toContain('to="/festival-opportunities"');
    expect(directory).toContain("useMyFestivalAttendance");
    expect(directory).toContain("My Festivals");
    expect(directory).toContain("Ready to check in");
    expect(directory).toContain("Ticket booked");
  });

  it("keeps ticket purchase and authoritative check-in on the canonical public Festival page", () => {
    expect(publicPage).toContain("usePurchaseFestivalTickets");
    expect(publicPage).toContain("useCheckInToFestival");
    expect(publicPage).toContain("Check in to festival");
    expect(publicPage).toContain("festival wristband");
  });
});
