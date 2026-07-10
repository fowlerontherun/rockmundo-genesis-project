import { describe, expect, it } from "vitest";
import { withoutDuplicateBandScheduleActivities } from "../bandActivityScheduling";

describe("band activity schedule helpers", () => {
  it("keeps one visible schedule item for the same linked rehearsal", () => {
    const activities = withoutDuplicateBandScheduleActivities([
      { id: "scheduled-row", activity_type: "rehearsal", linked_rehearsal_id: "reh-1" },
      { id: "canonical-rehearsal", activity_type: "rehearsal", linked_rehearsal_id: "reh-1" },
      { id: "solo-practice", activity_type: "skill_practice" },
    ]);

    expect(activities.map(activity => activity.id)).toEqual(["scheduled-row", "solo-practice"]);
  });

  it("does not collapse unrelated solo and band activities", () => {
    const activities = withoutDuplicateBandScheduleActivities([
      { id: "solo-recording", activity_type: "recording", linked_recording_id: null, metadata: { sessionId: "solo-1" } },
      { id: "band-recording", activity_type: "recording", linked_recording_id: "rec-1" },
      { id: "band-recording-duplicate", activity_type: "recording", metadata: { sessionId: "rec-1" } },
    ]);

    expect(activities.map(activity => activity.id)).toEqual(["solo-recording", "band-recording"]);
  });
});
