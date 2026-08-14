import { describe, expect, it } from "vitest";
import { buildGigViewerReplay } from "../../events/generator";
import { validateGigViewerReplay } from "../../events/schema";
import { buildLocalPresentationInput } from "../buildLocalPresentationInput";
import type { GigExperienceDTO } from "../../types";

describe("local presentation input", () => {
  it("normalizes mixed identities, blanks, positions, and remains deterministic", async () => {
    const experience = {
      gig: { scheduledDate: "2026-01-01T00:00:00Z", startedAt: null, completedAt: "2026-01-01T01:00:00Z", venue: { capacity: 100 } },
      viewer: { ready: true, resultReadyAt: "2026-01-01T01:00:00Z", outcomeId: "out" },
      headline: { attendance: { status: "available", value: 90 }, overallRating: { status: "available", value: 20 } },
      finances: { netProfit: { status: "available", value: 20 } },
      songs: [
        { id: "b", songId: "song-2", itemType: "song", performanceItemId: "bad", title: " ", position: 3, performanceScore: { status: "available", value: 19 }, performanceItemCategory: null, performanceItemRequiredSkill: null },
        { id: "i", songId: "bad", itemType: "performance_item", performanceItemId: "item-1", title: "Stage Dive", position: 2, performanceScore: { status: "legacy_missing" }, performanceItemCategory: "stage_action", performanceItemRequiredSkill: null },
        { id: "a", songId: "song-1", itemType: "song", performanceItemId: null, title: "Opener", position: 1, performanceScore: { status: "available", value: 18 }, performanceItemCategory: null, performanceItemRequiredSkill: null },
      ],
      performers: [{ profileId: " ", displayName: " ", roleOrInstrument: null, lineupStatus: "performed" }],
    } as unknown as GigExperienceDTO;
    const input = buildLocalPresentationInput("gig-DE5D68B2", experience);
    expect(input.songs.map(({ position, songId, performanceItemId, title }) => ({ position, songId, performanceItemId, title }))).toEqual([
      { position: 0, songId: "song-1", performanceItemId: null, title: "Opener" },
      { position: 1, songId: null, performanceItemId: "item-1", title: "Stage Dive" },
      { position: 2, songId: "song-2", performanceItemId: null, title: "Untitled song" },
    ]);
    expect(input.performers).toEqual([]);
    const first = await buildGigViewerReplay(input); const second = await buildGigViewerReplay(buildLocalPresentationInput("gig-DE5D68B2", experience));
    expect(validateGigViewerReplay(first).valid).toBe(true);
    expect(second.events).toEqual(first.events); expect(second.checksum).toBe(first.checksum);
  });
});
