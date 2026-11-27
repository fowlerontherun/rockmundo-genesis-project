import { describe, expect, it } from "vitest";
import { buildLoginProgressView, type LoginProgressClaim } from "./loginProgressSummary";

type Visible = Extract<LoginProgressClaim, { show: true }>;
const sample = (changes: Partial<Visible> = {}): Visible => ({
  show: true,
  session_id: "new-session",
  first_login: false,
  previous: {
    total_xp: 200, level: 2, captured_at: "2026-11-20T12:00:00Z",
    skills: { songwriting: { level: 2, xp: 80, required: 200 }, vocals: { level: 1, xp: 110, required: 160 } },
  },
  current: {
    total_xp: 500, level: 3, captured_at: "2026-11-27T12:00:00Z",
    skills: {
      songwriting: { level: 3, xp: 20, required: 300 },
      vocals: { level: 1, xp: 155, required: 160 },
      production: { level: 0, xp: 25, required: 100 },
    },
  },
  ...changes,
});

describe("login recap calculations", () => {
  it("shows earned XP and character and skill level-ups", () => {
    const view = buildLoginProgressView(sample());
    expect(view.xpGained).toBe(300);
    expect(view.levelGained).toBe(1);
    expect(view.skillsImproved).toBe(3);
    expect(view.featuredSkills.map((skill) => skill.slug)).toEqual(["songwriting", "vocals", "production"]);
    expect(view.featuredSkills[0]).toMatchObject({ previousLevel: 2, currentLevel: 3, xpGained: 0 });
    expect(view.featuredSkills[1]).toMatchObject({ xpGained: 45, percent: 97 });
  });
  it("does not invent gains on the first snapshot", () => {
    const view = buildLoginProgressView(sample({ first_login: true, previous: null }));
    expect(view).toMatchObject({ xpGained: 0, levelGained: 0, skillsImproved: 0, currentTotalXp: 500, hasGains: false });
    expect(view.featuredSkills[0].slug).toBe("songwriting");
  });
  it("shows strongest skills on an unchanged return", () => {
    const initial = sample();
    const view = buildLoginProgressView(sample({ current: initial.previous! }));
    expect(view.hasGains).toBe(false);
    expect(view.featuredSkills.map((skill) => skill.slug)).toEqual(["songwriting", "vocals"]);
  });
  it("does not show negative gains after a data correction", () => {
    const original = sample();
    const view = buildLoginProgressView(sample({ current: { ...original.current, total_xp: 100, level: 1, skills: {} } }));
    expect(view).toMatchObject({ xpGained: 0, levelGained: 0, skillsImproved: 0, featuredSkills: [] });
  });
});
