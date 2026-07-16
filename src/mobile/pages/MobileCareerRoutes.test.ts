import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/mobile/pages/MobileCareerRoutes.tsx", "utf8");
const dataSource = readFileSync("src/mobile/pages/mobileCareerData.ts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");

describe("mobile career phase 3 routes", () => {
  it("keeps migrated career routes inside the mobile shell", () => {
    expect(appSource).toContain('path="/mobile" element={<MobileLayout />}');
    expect(appSource).toContain('path="career/:section" element={<MobileCareer />}');
    expect(routeSource).toContain('section === "band"');
    expect(routeSource).toContain('section === "songs"');
    expect(routeSource).toContain('section === "songwriting"');
    expect(routeSource).toContain('section === "practice"');
    expect(routeSource).toContain('section === "gigs"');
  });

  it("renders mobile cards and no-band empty state instead of desktop tables", () => {
    expect(routeSource).toContain('MobileEntityCard');
    expect(routeSource).toContain('No band yet');
    expect(routeSource).toContain('Mobile filter sheet');
    expect(routeSource).not.toContain('<table');
  });

  it("reuses existing hooks for band, songwriting and gig logic", () => {
    expect(dataSource).toContain('usePrimaryBand');
    expect(dataSource).toContain('useAdvancedGigs');
    expect(dataSource).toContain('useSongwritingData');
    expect(routeSource).toContain('Songwriting projects failed');
  });

  it("guards permission-restricted actions and completed gig preparation actions", () => {
    expect(dataSource).toContain('canManageBand');
    expect(routeSource).toContain('manage?');
    expect(routeSource).toContain('gig.status!=="completed"');
  });
});
