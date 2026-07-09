import { describe, expect, it } from "vitest";
import { buildManagerRecommendations } from "./managerRecommendations";

describe("buildManagerRecommendations", () => {
  it("returns an empty list when no rules match", () => {
    expect(buildManagerRecommendations({ profile: { health: 100, energy: 100 } })).toEqual([]);
  });

  it("prioritizes critical vitals and important messages", () => {
    const recommendations = buildManagerRecommendations({
      profile: { health: 18, energy: 30 },
      unreadImportantMessages: 2,
      songsReadyToRecord: 1,
    });

    expect(recommendations.map((item) => item.id)).toEqual([
      "vitals-low",
      "important-messages",
      "songs-ready-record",
    ]);
    expect(recommendations[0].priority).toBe("high");
  });

  it("caps output at five reusable recommendations", () => {
    const recommendations = buildManagerRecommendations({
      profile: { health: 25, energy: 25 },
      unreadImportantMessages: 1,
      recordingsReadyToRelease: 3,
      songsReadyToRecord: 4,
      needsBandRehearsal: true,
      upcomingActivities: [{ id: "activity-1", title: "Club gig" }],
    });

    expect(recommendations).toHaveLength(5);
    expect(recommendations.some((item) => item.id === "upcoming-activity")).toBe(false);
  });
});
