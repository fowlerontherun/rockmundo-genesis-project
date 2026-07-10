import { describe, expect, it } from "vitest";
import { getContributionDisplay, getContributionSourceLabel, summarizeContributions, type BandContributionEvent } from "./bandContributions";

const base = (id: string, profileId: string, type: string): BandContributionEvent => ({
  id,
  band_id: "band-1",
  profile_id: profileId,
  contribution_type: type,
  source_entity_type: "band_rehearsal",
  source_entity_id: `source-${id}`,
  occurred_at: "2026-07-10T10:00:00Z",
  metadata: { label: "Completed band rehearsal" },
  created_at: "2026-07-10T10:00:01Z",
  profiles: { id: profileId, username: profileId, display_name: null, avatar_url: null },
});

describe("band contribution display helpers", () => {
  it("maps supported contribution types to player-facing labels", () => {
    expect(getContributionDisplay("rehearsal_attendance").label).toBe("Rehearsal attendance");
    expect(getContributionDisplay("recording_participation").label).toBe("Recording participation");
    expect(getContributionDisplay("gig_performance").label).toBe("Gig performance");
  });

  it("uses a safe fallback for unsupported future contribution types", () => {
    expect(getContributionDisplay("future_type").label).toBe("Band activity");
  });

  it("prefers safe metadata labels and falls back to source type", () => {
    expect(getContributionSourceLabel(base("1", "profile-1", "rehearsal_attendance"))).toBe("Completed band rehearsal");
    expect(getContributionSourceLabel({ metadata: {}, source_entity_type: "gig_outcome" })).toBe("Gig Outcome");
  });

  it("summarizes total, member, and type counts without ranking semantics", () => {
    const summary = summarizeContributions([
      base("1", "profile-1", "rehearsal_attendance"),
      base("2", "profile-1", "gig_performance"),
      base("3", "profile-2", "gig_performance"),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.byMember).toEqual(expect.arrayContaining([
      expect.objectContaining({ profileId: "profile-1", count: 2 }),
      expect.objectContaining({ profileId: "profile-2", count: 1 }),
    ]));
    expect(summary.byType).toEqual(expect.arrayContaining([
      { type: "rehearsal_attendance", count: 1 },
      { type: "gig_performance", count: 2 },
    ]));
  });
});
