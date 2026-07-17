import { describe, expect, it } from "vitest";
import { scheduleTemplates, workspaceSchema } from "./model";

describe("festival scheduling model", () => {
  it("validates the workspace projection contract", () => {
    const parsed = workspaceSchema.parse({
      festival: { id: "festival-1" }, edition: { id: "edition-1" }, timeZone: "Europe/London", festivalDates: ["2027-07-17"], scheduleState: "draft", draftRevision: { id: "revision-1", revision_number: 1 }, publishedRevision: null, revisionHistory: [], stages: [{ id: "stage-1", stage_name: "Main" }], operatingHours: [], scheduleItems: [{ id: "item-1", festival_id: "festival-1", edition_id: "edition-1", stage_id: "stage-1", festival_date: "2027-07-17", item_type: "performance_slot", starts_at: "2027-07-17T18:00:00Z", ends_at: "2027-07-17T19:00:00Z", duration_minutes: 60, title: "Headliner" }], unscheduledItems: [], conflictSummary: { items: [], blockingCount: 0 }, readinessSummary: {}, permissions: { viewSchedule: true }, availableActions: ["publish_schedule"]
    });
    expect(parsed.scheduleItems[0].title).toBe("Headliner");
  });

  it("ships the required initial template catalogue", () => {
    expect(scheduleTemplates.map(([id]) => id)).toEqual(["small_stage", "standard_stage", "festival_main_stage", "new_music_stage", "electronic_stage"]);
  });
});
