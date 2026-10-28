import { describe, expect, it } from "vitest";
import {
  readPublicFestivalStageCrowds,
  festivalCrowdBandLabels,
  festivalCrowdMoodLabels,
} from "../domain/publicFestivalStageCrowds";

const launchId = "123e4567-e89b-42d3-a456-426614174000";
const crowd = {
  stageId: "123e4567-e89b-42d3-a456-426614174001",
  stageName: "Main Stage",
  crowdBand: "busy",
  mood: "excited",
  stageStatus: "ready",
};
const payload = (stageCrowds: unknown, overrides: Record<string, unknown> = {}) => ({
  festivalLaunchId: launchId,
  currentDay: "2026-10-28",
  stageCrowds,
  ...overrides,
});

describe("public festival stage crowd snapshots", () => {
  it("accepts an unambiguous report for the correct festival edition", () => {
    expect(readPublicFestivalStageCrowds(payload([crowd]), launchId)).toEqual([{
      stageId: crowd.stageId,
      stageName: crowd.stageName,
      crowdBand: crowd.crowdBand,
      mood: crowd.mood,
    }]);
    expect(festivalCrowdBandLabels.busy).toBe("Busy");
    expect(festivalCrowdMoodLabels.excited).toBe("Excited");
  });

  it("does not leak crowd data across festival editions", () => {
    expect(readPublicFestivalStageCrowds(payload([crowd]), "another-launch-id")).toEqual([]);
  });

  it("does not claim crowd activity when there is no active festival day", () => {
    expect(readPublicFestivalStageCrowds(payload([crowd], { currentDay: null }), launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload([crowd], { currentDay: "invalid" }), launchId)).toEqual([]);
  });

  it("rejects malformed responses and unknown mood or crowd bands", () => {
    expect(readPublicFestivalStageCrowds(null, launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload(null), launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload([
      { ...crowd, crowdBand: "imaginary" },
      { ...crowd, mood: "supercharged" },
      { ...crowd, stageId: "" },
      { ...crowd, stageName: "" },
    ]), launchId)).toEqual([]);
  });

  it("suppresses duplicate stage names rather than selecting a stale festival-day snapshot", () => {
    const duplicate = { ...crowd, stageId: "other-day", stageName: " MAIN STAGE ", mood: "tired" };
    const secondary = { ...crowd, stageId: "other-stage", stageName: "Acoustic Stage", crowdBand: "quiet", mood: "calm" };
    expect(readPublicFestivalStageCrowds(payload([crowd, duplicate, secondary]), launchId)).toEqual([{
      stageId: "other-stage",
      stageName: "Acoustic Stage",
      crowdBand: "quiet",
      mood: "calm",
    }]);
  });

  it("preserves genuinely quiet stage reports rather than treating them as missing", () => {
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, crowdBand: "quiet", mood: "calm" }]), launchId)[0]?.crowdBand).toBe("quiet");
  });
});
