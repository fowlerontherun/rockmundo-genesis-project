import { describe, expect, it } from "vitest";
import { festivalPosterTiers } from "./festivalPosterTiers";

describe("festivalPosterTiers", () => {
  it("bills one headliner, three sub-headliners and the rest as support", () => {
    const t = festivalPosterTiers(["A", "B", "C", "D", "E", "F"]);
    expect(t.headliners).toEqual(["A"]);
    expect(t.subHeadliners).toEqual(["B", "C", "D"]);
    expect(t.support).toEqual(["E", "F"]);
  });
  it("drops blank and duplicate names", () => {
    expect(festivalPosterTiers(["A", " ", "A", "B"]).subHeadliners).toEqual(["B"]);
  });
});
