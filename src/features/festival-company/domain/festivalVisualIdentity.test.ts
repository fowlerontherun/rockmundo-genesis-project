import { describe, expect, it } from "vitest";
import { festivalVisualIdentity, stagePublishedHeadliners, stageVisualScale } from "./festivalVisualIdentity";

const festival = { id: "edition-a", festivalType: "rock", vibe: "outdoor", scale: "regional" };

describe("festival visual identity", () => {
  it("keeps procedural branding stable for the same published edition", () => {
    expect(festivalVisualIdentity(festival)).toEqual(festivalVisualIdentity({ ...festival }));
    expect(festivalVisualIdentity({ ...festival, id: "edition-b" })).not.toEqual(festivalVisualIdentity(festival));
    expect(festivalVisualIdentity(festival).typeLabel).toBe("rock");
  });

  it("falls back to an honest festival label when the curator has not supplied descriptors", () => {
    const identity = festivalVisualIdentity({ id: "edition-a", festivalType: null, vibe: null, scale: null });
    expect(identity.typeLabel).toBe("Music festival");
    expect(identity.vibeLabel).toBeNull();
  });

  it("scales stage artwork using published capacity, including small and zero-capacity stages", () => {
    const stage = { id: "stage", name: "Stage", capacity: 0 };
    expect(stageVisualScale(stage).label).toBe("Stage scale unavailable");
    expect(stageVisualScale({ ...stage, capacity: 249 }).lights).toBe(2);
    expect(stageVisualScale({ ...stage, capacity: 250 }).lights).toBe(4);
    expect(stageVisualScale({ ...stage, capacity: 1000 }).lights).toBe(5);
    expect(stageVisualScale({ ...stage, capacity: 5000 }).lights).toBe(7);
  });

  it("uses only published, stage-assigned headliners, never other stages or inferred fame", () => {
    const act = { id: "act", artistName: "The Set", artistType: "band" as const, genre: "rock", billingPosition: "headliner", festivalDate: null, stageName: "Main", startsAt: null, endsAt: null };
    expect(stagePublishedHeadliners("Main", [act, { ...act, id: "other", stageName: "Side" }, { ...act, id: "support", billingPosition: "support" }])).toEqual([act]);
    expect(stagePublishedHeadliners("Unpublished", [act])).toEqual([]);
  });
});
