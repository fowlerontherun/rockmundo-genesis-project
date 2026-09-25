import { describe, expect, it } from "vitest";
import { scoreAssignedShowCrew } from "../../../supabase/functions/_shared/crew-score";

const roster = [
  { id: "sound", skill_level: 90, cohesion_rating: 50 },
  { id: "lighting", skill_level: 70, cohesion_rating: 0 },
  { id: "road", skill_level: 60, cohesion_rating: 25 },
  { id: "backline", skill_level: 80, cohesion_rating: 0 },
];
const assign = (id: string, role: string, status = "accepted") => ({
  band_crew_member_id: id,
  crew_role: role,
  assignment_status: status,
});

describe("gig-specific show crew scoring", () => {
  it("does not grant roster bonuses before assignments exist", () => {
    expect(scoreAssignedShowCrew(roster, [])).toEqual({
      score: 40, filledRoles: 0, assignedCount: 0,
    });
  });

  it("weights distinct production roles rather than averaging all staff", () => {
    expect(scoreAssignedShowCrew(roster, [
      assign("sound", "sound_engineer"),
      assign("lighting", "lighting_engineer"),
      assign("road", "stage_manager"),
      assign("backline", "guitar_technician"),
    ])).toEqual({ score: 80, filledRoles: 4, assignedCount: 4 });
  });

  it("excludes absent, declined, foreign and phantom workers", () => {
    const score = scoreAssignedShowCrew(roster, [
      assign("sound", "sound_engineer"),
      assign("lighting", "lighting_engineer", "declined"),
      assign("phantom", "stage_manager"),
      assign("backline", "guitar_technician", "absent"),
    ]);
    expect(score.filledRoles).toBe(1);
    expect(score.assignedCount).toBe(1);
    expect(score.score).toBe(56);
  });

  it("caps extremely high skills and cohesion at 100", () => {
    expect(scoreAssignedShowCrew([{ id: "sound", skill_level: 100, cohesion_rating: 100 }], [
      assign("sound", "sound_engineer"),
    ])).toEqual({ score: 59, filledRoles: 1, assignedCount: 1 });
  });
});
