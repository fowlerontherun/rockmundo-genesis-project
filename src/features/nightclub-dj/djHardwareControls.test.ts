import { describe, expect, it } from "vitest";
import {
  djHotCueSeek, djJogSeek, emptyDjHotCues, storeDjHotCue,
} from "./djHardwareControls";

describe("RockMundo controller hot cues and jog behaviour", () => {
  it("opens with eight empty, independent cue positions", () => {
    const cues = emptyDjHotCues();
    expect(cues).toHaveLength(8);
    expect(cues.every(value => value === null)).toBe(true);
    const next = storeDjHotCue(cues, 0, 23.5, 180);
    expect(next[0]).toBe(23.5);
    expect(cues[0]).toBeNull();
    expect(next.slice(1).every(value => value === null)).toBe(true);
  });

  it("supports cue at precisely zero without interpreting it as unset", () => {
    const cues = storeDjHotCue(emptyDjHotCues(), 3, 0, 90);
    expect(djHotCueSeek(cues, 3, 90)).toBe(0);
    expect(djHotCueSeek(cues, 0, 90)).toBeNull();
  });

  it("clamps a stored cue to playable media duration", () => {
    const cues = storeDjHotCue(emptyDjHotCues(), 7, 200, 65);
    expect(djHotCueSeek(cues, 7, 65)).toBe(65);
    expect(djHotCueSeek(cues, 7, 40)).toBe(40);
  });

  it("rejects malformed pad presses and bad duration without mutation", () => {
    const cues = emptyDjHotCues();
    expect(storeDjHotCue(cues, -1, 1, 20)).toBe(cues);
    expect(storeDjHotCue(cues, 8, 1, 20)).toBe(cues);
    expect(storeDjHotCue(cues, 0.5, 1, 20)).toBe(cues);
    expect(storeDjHotCue(cues, 0, Number.NaN, 20)).toBe(cues);
    expect(storeDjHotCue(cues, 0, -1, 20)).toBe(cues);
    expect(storeDjHotCue(cues, 0, 1, 0)).toBe(cues);
    expect(djHotCueSeek(cues, -1, 20)).toBeNull();
    expect(djHotCueSeek(cues, 0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("nudges the actual media position with bounds, not a fake scratch event", () => {
    expect(djJogSeek(16, -1, 60)).toBe(15);
    expect(djJogSeek(16, 1, 60)).toBe(17);
    expect(djJogSeek(0, -1, 60)).toBe(0);
    expect(djJogSeek(60, 1, 60)).toBe(60);
    expect(djJogSeek(30, 500, 60)).toBeNull();
    expect(djJogSeek(30, Number.NaN, 60)).toBeNull();
    expect(djJogSeek(30, 1, 0)).toBeNull();
  });
});