import { describe, expect, it } from "vitest";
import { calculateSongwritingFinal, calculateSongwritingSession } from "../songwritingOutcomeCalculator";

const base = {
  sessionType: "balanced" as const,
  effortHours: 2 as const,
  projectChoices: { genres: ["rock"], mode: "standard", chordDifficulty: 3 },
  state: { musicProgress: 600, lyricsProgress: 600, totalSessions: 1, health: 90, energy: 90, stress: 10 },
  contributors: [{ profileId: "p1", accepted: true, attended: true, role: "co_writer", skills: { songwriting: 40, composition: 30, technical: 10, guitar: 20, genres_basic_rock: 35 }, attributes: { creative_insight: 40, musical_ability: 35, mental_focus: 40, musicality: 35 } }],
};

describe("songwriting outcome calculator", () => {
  it("uses relevant skills as a larger driver than attributes", () => {
    const highSkill = calculateSongwritingSession(base);
    const highAttr = calculateSongwritingSession({ ...base, contributors: [{ ...base.contributors[0], skills: {}, attributes: { creative_insight: 100, musical_ability: 100, mental_focus: 100, musicality: 100 } }] });
    expect(highSkill.musicProgressGained).toBeGreaterThan(highAttr.musicProgressGained);
  });

  it("applies supported duration modifiers", () => {
    const one = calculateSongwritingSession({ ...base, effortHours: 1 });
    const four = calculateSongwritingSession({ ...base, effortHours: 4 });
    expect(four.musicProgressGained).toBeGreaterThan(one.musicProgressGained * 3);
    expect(four.musicProgressGained).toBeLessThan(one.musicProgressGained * 4);
  });

  it("ignores unaccepted collaborators and rewards complementary accepted collaborators with diminishing returns", () => {
    const solo = calculateSongwritingSession(base);
    const invited = calculateSongwritingSession({ ...base, contributors: [...base.contributors, { profileId: "p2", accepted: false, attended: true, role: "composer", skills: { songwriting: 100, composition: 100 }, attributes: {} }] });
    const duet = calculateSongwritingSession({ ...base, contributors: [...base.contributors, { profileId: "p3", accepted: true, attended: true, role: "lyricist", skills: { songwriting: 55, vocals: 50 }, attributes: { creative_insight: 60 } }] });
    expect(invited.musicProgressGained).toEqual(solo.musicProgressGained);
    expect(duet.musicProgressGained).toBeGreaterThan(solo.musicProgressGained);
    expect(duet.musicProgressGained).toBeLessThan(solo.musicProgressGained * 1.25);
  });

  it("keeps final score deterministic, bounded, and completion-sensitive", () => {
    const incomplete = calculateSongwritingFinal({ ...base, seed: "project-a" });
    const complete = calculateSongwritingFinal({ ...base, state: { ...base.state, musicProgress: 2000, lyricsProgress: 2000, polish: 120, consistency: 160 }, seed: "project-a" });
    const rerun = calculateSongwritingFinal({ ...base, state: { ...base.state, musicProgress: 2000, lyricsProgress: 2000, polish: 120, consistency: 160 }, seed: "project-a" });
    expect(complete.finalScore).toEqual(rerun.finalScore);
    expect(complete.finalScore).toBeGreaterThan(incomplete.finalScore);
    expect(complete.finalScore).toBeGreaterThanOrEqual(0);
    expect(complete.finalScore).toBeLessThanOrEqual(1000);
  });
});
