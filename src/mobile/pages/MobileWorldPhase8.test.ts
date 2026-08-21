import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/mobile/pages/MobileWorldPhase5.tsx"), "utf8");

describe("Mobile World companion contract", () => {
  it("keeps only overview and travel as first-class mobile World flows", () => {
    expect(source).toContain('to="/mobile/world"');
    expect(source).toContain('to="/mobile/world/travel"');
    expect(source).toContain('if (section === "travel") return <TravelMobile />');
    expect(source).toContain('return <WorldOverviewMobile />');
  });

  it("gates deep World systems behind explicit desktop-only boundaries", () => {
    for (const section of ["venues", "companies", "jobs", "marketplace", "shops", "charts", "festivals", "events", "search", "city", "locations"]) {
      expect(source).toContain(`${section}:`);
    }
    expect(source).toContain("Desktop world gameplay");
    expect(source).toContain("remain desktop gameplay");
  });

  it("reuses the authoritative travel engine instead of mobile-only economy logic", () => {
    expect(source).toContain('import { bookTravel } from "@/utils/travelSystem"');
    expect(source).toContain("getAvailableModes");
    expect(source).toContain("getNextAvailableDeparture");
    expect(source).toContain("await bookTravel({");
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] })');
  });
});
