import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/mobile/pages/MobileCareerRoutes.tsx", "utf8");
const dataSource = readFileSync("src/mobile/pages/mobileCareerData.ts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const rehearsalBookingSource = readFileSync("src/hooks/useRehearsalBooking.ts", "utf8");

describe("mobile career phase 4 routes", () => {
  it("keeps migrated career routes inside the mobile shell", () => {
    expect(appSource).toContain('path="/mobile" element={<MobileLayout />}');
    expect(appSource).toContain('path="career/:section" element={<MobileCareer />}');
    for (const section of ['section === "band"', 'section === "songs"', 'section === "songwriting"', 'section === "practice"', 'section === "recording"', 'section === "rehearsals"', 'section === "setlists"', 'section === "gigs"']) {
      expect(routeSource).toContain(section);
    }
  });

  it("extends mobile career sub-navigation without wrapping into desktop tabs", () => {
    for (const label of ["Recording", "Rehearsals", "Gigs", "Practice"]) expect(routeSource).toContain(label);
    expect(routeSource).toContain("overflow-x-auto");
    expect(routeSource).not.toContain("<table");
  });

  it("uses mobile cards for recording sessions, rehearsals, setlists and readiness", () => {
    for (const text of ["RecordingCard", "RehearsalCard", "Setlist editor", "MobileProgressCard", "MobileStickyActionBar"]) {
      expect(routeSource).toContain(text);
    }
    expect(routeSource).toContain("Book studio");
    expect(routeSource).toContain("Book rehearsal");
  });

  it("reuses existing hooks, queries, validation and readiness utilities", () => {
    expect(dataSource).toContain('usePrimaryBand');
    expect(dataSource).toContain('useAdvancedGigs');
    expect(dataSource).toContain('band_rehearsals');
    expect(routeSource).toContain('useRecordingSessions');
    expect(routeSource).toContain('useSetlists');
    expect(routeSource).toContain('useSetlistSongs');
    expect(routeSource).toContain('validateGigSetlist');
    expect(routeSource).toContain('calculateGigReadiness');
  });

  it("blocks past-time rehearsal and recording dates before confirmation", () => {
    expect(rehearsalBookingSource).toContain('validateFutureTime(params.scheduledStart)');
    expect(routeSource).toContain('min={today}');
    expect(routeSource).toContain('Past dates cannot be selected');
    expect(routeSource).toContain('Past dates are blocked');
  });

  it("guards permission-restricted actions and completed gig preparation actions", () => {
    expect(dataSource).toContain('canManageBand');
    expect(routeSource).toContain('manage?');
    expect(routeSource).toContain('gig.status!=="completed"');
    expect(routeSource).toContain('Completed gigs do not show preparation actions');
  });
});
