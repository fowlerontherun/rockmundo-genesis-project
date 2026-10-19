import { describe, expect, it } from "vitest";
import { djStageEvidencePageSize, djStageEvidenceQueryKey } from "./djStageEvidenceQuery";

describe("DJ stage evidence cache isolation", () => {
  it("keeps a limited live viewer cache separate from a full completed replay", () => {
    const live = djStageEvidenceQueryKey("character-1", "booking-1", "live");
    const replay = djStageEvidenceQueryKey("character-1", "booking-1", "replay");
    expect(live).not.toEqual(replay);
    expect(djStageEvidencePageSize("live")).toBe(24);
    expect(djStageEvidencePageSize("replay")).toBe(120);
  });

  it("keeps evidence private to the chosen character and booking", () => {
    expect(djStageEvidenceQueryKey("character-1", "booking-1", "live"))
      .not.toEqual(djStageEvidenceQueryKey("character-2", "booking-1", "live"));
    expect(djStageEvidenceQueryKey("character-1", "booking-1", "replay"))
      .not.toEqual(djStageEvidenceQueryKey("character-1", "booking-2", "replay"));
  });

  it("returns stable keys for the same canonical mode and selected character", () => {
    expect(djStageEvidenceQueryKey("p", "b", "replay"))
      .toEqual(djStageEvidenceQueryKey("p", "b", "replay"));
  });
});
