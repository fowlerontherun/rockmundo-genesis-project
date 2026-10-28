import { describe, expect, it } from "vitest";
import { getFestivalPublicStageCrowds } from "../domain/festivalPublicStageCrowds";

const festivalLaunchId = "123e4567-e89b-42d3-a456-426614174000";
const otherFestivalLaunchId = "123e4567-e89b-42d3-a456-426614174001";
const stages = [
  { id: "stage-one", name: "Main Stage" },
  { id: "stage-two", name: "Acoustic Tent" },
];
const snapshot = (stageCrowds: unknown) => ({ festivalLaunchId, stageCrowds });

describe("public festival stage crowd projection", () => {
  it("matches validated stage bands and moods to unique public stage names", () => {
    expect(getFestivalPublicStageCrowds(snapshot([
      { stageId: "runtime-one", stageName: "Main Stage", crowdBand: "very_busy", mood: "excited" },
      { stageId: "runtime-two", stageName: "Acoustic Tent", crowdBand: "quiet", mood: "calm" },
    ]), festivalLaunchId, stages)).toEqual({
      "stage-one": { crowdBand: "very_busy", mood: "excited" },
      "stage-two": { crowdBand: "quiet", mood: "calm" },
    });
  });

  it("rejects snapshots belonging to another festival", () => {
    expect(getFestivalPublicStageCrowds({ festivalLaunchId: otherFestivalLaunchId, stageCrowds: [
      { stageName: "Main Stage", crowdBand: "busy", mood: "engaged" },
    ] }, festivalLaunchId, stages)).toEqual({});
  });

  it("does not mistake absent or malformed stage crowd data for a quiet stage", () => {
    expect(getFestivalPublicStageCrowds(null, festivalLaunchId, stages)).toEqual({});
    expect(getFestivalPublicStageCrowds(snapshot(null), festivalLaunchId, stages)).toEqual({});
    expect(getFestivalPublicStageCrowds(snapshot({}), festivalLaunchId, stages)).toEqual({});
  });

  it("rejects unsupported band and mood values", () => {
    expect(getFestivalPublicStageCrowds(snapshot([
      { stageName: "Main Stage", crowdBand: "fuller_than_full", mood: "calm" },
      { stageName: "Acoustic Tent", crowdBand: "busy", mood: "super_happy" },
    ]), festivalLaunchId, stages)).toEqual({});
  });

  it("ignores unknown names and duplicate public stage names", () => {
    expect(getFestivalPublicStageCrowds(snapshot([
      { stageName: "Unknown", crowdBand: "busy", mood: "engaged" },
      { stageName: "Main Stage", crowdBand: "busy", mood: "engaged" },
    ]), festivalLaunchId, [...stages, { id: "stage-three", name: "Main Stage" }])).toEqual({});
  });

  it("rejects duplicate runtime rows for the same stage rather than choosing an arbitrary value", () => {
    expect(getFestivalPublicStageCrowds(snapshot([
      { stageName: "Main Stage", crowdBand: "busy", mood: "engaged" },
      { stageName: "Main Stage", crowdBand: "full", mood: "leaving" },
    ]), festivalLaunchId, stages)).toEqual({});
  });
});
