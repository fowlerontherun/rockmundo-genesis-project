import { describe, expect, it } from "vitest";
import { buildSteps } from "./GettingStartedPanel";

describe("GettingStartedPanel step generation", () => {
  it("shows first-step prompts with valid routes for a new player", () => {
    const steps = buildSteps({ id: "profile-1", level: 1 }, { skillRows: 0, songCount: 0, recordingCount: 0, activityCount: 0, bandCount: 0 });

    expect(steps.map((step) => step.id)).toEqual(["profile", "skills", "song", "activity"]);
    expect(steps.every((step) => step.href.startsWith("/"))).toBe(true);
    expect(steps.find((step) => step.id === "song")?.href).toBe("/booking/songwriting");
    expect(steps.find((step) => step.id === "skills")?.href).toBe("/skills");
  });

  it("does not generate inappropriate beginner blockers for established players with progress", () => {
    const steps = buildSteps(
      { id: "profile-1", level: 8, display_name: "Beta Vet", city_id: "city-1" },
      { skillRows: 6, songCount: 3, recordingCount: 1, activityCount: 2, bandCount: 1 },
    );

    expect(steps.filter((step) => !step.optional).every((step) => step.completed)).toBe(true);
    expect(steps.some((step) => step.id === "release" && step.href === "/release-manager")).toBe(true);
  });
});
