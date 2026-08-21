import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/mobile/pages/MobileCareerRoutes.tsx", "utf8");
const careerSource = readFileSync("src/mobile/pages/MobileCareer.tsx", "utf8");

describe("mobile Career companion routes", () => {
  it("keeps the mobile Career surface focused on companion actions", () => {
    expect(careerSource).toContain("Career companion");
    expect(careerSource).toContain("My Day");
    expect(careerSource).toContain("Quick Practice");
    expect(careerSource).toContain("Recent outcomes");
    expect(careerSource).toContain("Desktop career management");
  });

  it("does not advertise deep Career management as mobile quick actions", () => {
    for (const legacyAction of ["Write Song", "Book Rehearsal", "Setlist", "Book Studio", "Band command"]) {
      expect(careerSource).not.toContain(legacyAction);
    }
  });

  it("routes quick practice into the authoritative My Day practice flow", () => {
    expect(routeSource).toContain('section === "practice"');
    expect(routeSource).toContain('/mobile?view=day#practice');
  });

  it("lets schedule-oriented Career sections hand off to My Day", () => {
    expect(routeSource).toContain('new Set(["gigs", "rehearsals", "recording"])');
    expect(routeSource).toContain("Check your schedule");
    expect(routeSource).toContain('/mobile?view=day');
  });

  it("gates deep Career sections behind the desktop boundary", () => {
    for (const label of ["Band management", "Song library", "Songwriting", "Setlists", "Tours", "Releases", "Streaming", "Charts", "Awards"]) {
      expect(routeSource).toContain(label);
    }
    expect(routeSource).toContain("Continue on desktop");
    expect(routeSource).toContain("intentionally desktop-only");
  });

  it("does not mount old deep mobile booking and management components", () => {
    for (const oldComponent of ["RecordingBooking", "RehearsalBooking", "SetlistDetail", "TourCreate", "ReleaseCreate", "SongwritingPage"]) {
      expect(routeSource).not.toContain(oldComponent);
    }
  });
});
