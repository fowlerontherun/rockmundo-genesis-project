import { describe, expect, it } from "vitest";
import { getBandRoleCoverage, validateSynergyReward } from "../bandProgression";

describe("band progression role coverage", () => {
  const members = [
    { profileId: "vox", assignedRoles: ["lead_vocalist" as const], skills: [{ slug: "vocals", level: 12 }] },
    { profileId: "gtr1", assignedRoles: ["lead_guitarist" as const], skills: [{ slug: "guitar", level: 10 }] },
    { profileId: "gtr2", assignedRoles: ["rhythm_guitarist" as const], skills: [{ slug: "guitar", level: 6 }] },
    { profileId: "hidden-producer", assignedRoles: ["producer" as const], skills: [{ slug: "technical", level: 20, isPrivate: true }] },
  ];

  it("detects required, secondary, missing and duplicate coverage from canonical role mappings", () => {
    const coverage = getBandRoleCoverage({ bandId: "band-1", members });
    expect(coverage.requiredRoles).toContain("lead_vocalist");
    expect(coverage.missingCoverage).toEqual(expect.arrayContaining(["bassist", "drummer"]));
    expect(coverage.roles.find((role) => role.role === "lead_guitarist")?.readyMembers).toContain("gtr1");
    expect(coverage.roles.find((role) => role.role === "lead_guitarist")?.secondaryCoverage).toContain("gtr2");
    expect(coverage.duplicateCoverage.find((dup) => dup.role === "lead_guitarist")?.usefulBackup).toBe(true);
  });

  it("supports context-specific recording and gig coverage without exposing private hidden skills", () => {
    const recording = getBandRoleCoverage({ bandId: "band-1", members, context: "recording" });
    const gig = getBandRoleCoverage({ bandId: "band-1", members, context: "gig", upcomingActivities: [{ sourceType: "gig", sourceId: "gig-1", roleKeys: ["live_frontperson"] }] });
    expect(recording.requiredRoles).toContain("producer");
    expect(recording.missingCoverage).toContain("producer");
    expect(gig.requiredRoles).toContain("live_frontperson");
    expect(gig.upcomingActivityRelevance[0]).toContain("gig:gig-1");
    expect(recording.privacySafeExplanations.join(" ")).not.toContain("20");
  });

  it("keeps synergy rewards bounded, multi-participant and idempotent", () => {
    const valid = validateSynergyReward({ goalStatus: "active", participantProfileIds: ["vox", "gtr1"], relevantCompletedEventIds: ["lesson-1", "rehearsal-1"], distinctRoleKeys: ["lead_vocalist", "lead_guitarist"], bonusPercent: 4 });
    expect(valid.valid).toBe(true);
    expect(valid.cappedBonusPercent).toBe(4);
    expect(valid.idempotencyKey).toBe("band-goal-synergy:lesson-1+rehearsal-1");

    const farming = validateSynergyReward({ goalStatus: "active", participantProfileIds: ["vox", "vox"], relevantCompletedEventIds: ["lesson-1", "lesson-1"], distinctRoleKeys: ["lead_vocalist"], bonusPercent: 50 });
    expect(farming.valid).toBe(false);
    expect(farming.cappedBonusPercent).toBe(5);
  });
});
