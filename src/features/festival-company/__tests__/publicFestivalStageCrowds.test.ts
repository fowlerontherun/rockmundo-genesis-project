import { describe, expect, it } from "vitest";
import {
  readPublicFestivalStageCrowds,
  festivalCrowdBandLabels,
  festivalCrowdMoodLabels,
  filterPublicFestivalStageCrowdsForUniqueStages,
  filterFreshPublicFestivalStageCrowds,
} from "../domain/publicFestivalStageCrowds";

const launchId = "123e4567-e89b-42d3-a456-426614174000";
const crowd = {
  stageId: "123e4567-e89b-42d3-a456-426614174001",
  stageName: "Main Stage",
  festivalDate: "2026-10-28",
  lastCalculatedAt: "2026-10-28T15:15:00Z",
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
      festivalDate: crowd.festivalDate,
      lastCalculatedAt: crowd.lastCalculatedAt,
      crowdBand: crowd.crowdBand,
      mood: crowd.mood,
    }]);
    expect(festivalCrowdBandLabels.busy).toBe("Busy");
    expect(festivalCrowdMoodLabels.excited).toBe("Excited");
  });

  it("retains a measured stage density when crowd mood is not measured", () => {
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, mood: null }]), launchId)).toEqual([
      expect.objectContaining({ crowdBand: "busy", mood: null }),
    ]);
  });

  it("rejects previous-day, future-day and legacy unversioned crowd snapshots", () => {
    const legacy = Object.fromEntries(Object.entries(crowd).filter(([key]) => key !== "festivalDate"));
    expect(readPublicFestivalStageCrowds(payload([legacy]), launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, festivalDate: "2026-10-27" }]), launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, festivalDate: "2026-10-29" }]), launchId)).toEqual([]);
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, lastCalculatedAt: "bad-timestamp" }]), launchId)).toEqual([]);
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

  it("suppresses duplicate stage names instead of selecting an ambiguous snapshot", () => {
    const duplicate = { ...crowd, stageId: "other-day", stageName: " MAIN STAGE ", mood: "tired" };
    const secondary = { ...crowd, stageId: "other-stage", stageName: "Acoustic Stage", crowdBand: "quiet", mood: "calm" };
    expect(readPublicFestivalStageCrowds(payload([crowd, duplicate, secondary]), launchId)).toEqual([{
      stageId: "other-stage",
      stageName: "Acoustic Stage",
      festivalDate: crowd.festivalDate,
      lastCalculatedAt: crowd.lastCalculatedAt,
      crowdBand: "quiet",
      mood: "calm",
    }]);
  });

  it("suppresses ambiguous duplicate runtime stage names but retains distinct reports", () => {
    const side = { ...crowd, stageId: "side-stage", stageName: "Side Stage", mood: "calm" };
    const reports = readPublicFestivalStageCrowds(payload([crowd, side]), launchId);
    expect(filterPublicFestivalStageCrowdsForUniqueStages(reports, [
      { name: " Main Stage " }, { name: "MAIN STAGE" }, { name: "Side Stage" },
    ])).toEqual([expect.objectContaining({ stageName: "Side Stage" })]);
    expect(filterPublicFestivalStageCrowdsForUniqueStages(reports, [
      { name: "Main Stage" }, { name: "Side Stage" },
    ])).toHaveLength(2);
  });

  it("hides individual old stage observations while retaining fresh stage data", () => {
    const now = Date.parse("2026-10-28T15:30:00Z");
    const older = readPublicFestivalStageCrowds(payload([
      { ...crowd, stageName: "Main Stage", lastCalculatedAt: "2026-10-28T14:20:00Z" },
      { ...crowd, stageId: "new-stage", stageName: "Side Stage", lastCalculatedAt: "2026-10-28T15:28:00Z" },
    ]), launchId);
    expect(filterFreshPublicFestivalStageCrowds(older, now).map((item) => item.stageName)).toEqual(["Side Stage"]);
  });

  it("does not accept future-dated observations or invalid clocks as real audiences", () => {
    const now = Date.parse("2026-10-28T15:30:00Z");
    const rows = readPublicFestivalStageCrowds(payload([
      { ...crowd, stageName: "Future Stage", lastCalculatedAt: "2026-10-28T15:35:00Z" },
      { ...crowd, stageId: "near", stageName: "Near Stage", lastCalculatedAt: "2026-10-28T15:31:00Z" },
    ]), launchId);
    expect(filterFreshPublicFestivalStageCrowds(rows, now).map((item) => item.stageName)).toEqual(["Near Stage"]);
    expect(filterFreshPublicFestivalStageCrowds(rows, Number.NaN)).toEqual([]);
  });

  it("fails closed if two stage records reuse the same runtime stage identity", () => {
    const now = Date.parse("2026-10-28T15:20:00Z");
    const rows = readPublicFestivalStageCrowds(payload([
      crowd,
      { ...crowd, stageName: "Other Stage", mood: "tired" },
      { ...crowd, stageId: "independent-stage", stageName: "Third Stage" },
    ]), launchId);
    expect(filterFreshPublicFestivalStageCrowds(rows, now).map((item) => item.stageName)).toEqual(["Third Stage"]);
  });

    it("preserves genuinely quiet stage reports rather than treating them as missing", () => {
    expect(readPublicFestivalStageCrowds(payload([{ ...crowd, crowdBand: "quiet", mood: "calm" }]), launchId)[0]?.crowdBand).toBe("quiet");
  });
});
