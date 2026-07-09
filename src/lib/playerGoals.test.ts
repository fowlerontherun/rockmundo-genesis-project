import { describe, expect, it } from "vitest";
import { generatePlayerGoals, getNextFanTarget, type PlayerGoalInput } from "./playerGoals";

const baseInput: PlayerGoalInput = {
  draftSongs: 0,
  recordedSongs: 0,
  releasedMusic: 0,
  upcomingRehearsals: 0,
  recentRehearsals: 0,
  upcomingActivities: 0,
  health: 100,
  energy: 100,
  fans: 0,
  fame: 0,
};

describe("generatePlayerGoals", () => {
  it("prioritizes the first songwriting step for a new player", () => {
    const goals = generatePlayerGoals(baseInput);

    expect(goals[0]).toMatchObject({
      id: "write_song",
      href: "/songwriting",
      current: 0,
      target: 1,
      completed: false,
    });
  });

  it("moves players with written songs toward recording", () => {
    const goals = generatePlayerGoals({ ...baseInput, draftSongs: 2 });

    expect(goals[0]).toMatchObject({
      id: "record_song",
      href: "/recording-studio",
      progressLabel: "0/1 recorded",
    });
  });

  it("moves players with recorded songs toward release", () => {
    const goals = generatePlayerGoals({ ...baseInput, draftSongs: 3, recordedSongs: 1 });

    expect(goals[0]).toMatchObject({
      id: "release_music",
      href: "/release-manager",
      completed: false,
    });
  });

  it("surfaces wellness urgently when health and energy are low", () => {
    const goals = generatePlayerGoals({ ...baseInput, health: 35, energy: 45 });

    expect(goals[0]).toMatchObject({
      id: "improve_wellness",
      href: "/wellness",
      current: 40,
      target: 80,
    });
  });

  it("uses upcoming activities as measurable progress", () => {
    const goals = generatePlayerGoals({ ...baseInput, upcomingActivities: 2 });
    const activityGoal = goals.find((goal) => goal.id === "attend_activity");

    expect(activityGoal).toMatchObject({
      current: 1,
      target: 1,
      completed: true,
      progressLabel: "2 upcoming",
    });
  });
});

describe("getNextFanTarget", () => {
  it("uses simple milestone targets from existing fans or fame", () => {
    expect(getNextFanTarget(0, 0)).toBe(100);
    expect(getNextFanTarget(125, 0)).toBe(500);
    expect(getNextFanTarget(250, 80)).toBe(1_000);
    expect(getNextFanTarget(1_450, 0)).toBe(2_000);
  });
});
