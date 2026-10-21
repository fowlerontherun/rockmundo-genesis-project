import { describe, expect, it } from "vitest";
import { createDjBeatLoop, djBeatLoopSeekExits, wrapDjBeatLoopTime } from "./djBeatLoop";

describe("DJ source-media beat loops (no analysis and no rewards)", () => {
  it("loops four and eight beats from the real deck playhead", () => {
    expect(createDjBeatLoop(10, 120, 4, 40)).toEqual({ start: 10, end: 12, beats: 4 });
    expect(createDjBeatLoop(10, 120, 8, 40)).toEqual({ start: 10, end: 14, beats: 8 });
    const slower = createDjBeatLoop(15, 60, 4, 60);
    expect(slower).toEqual({ start: 15, end: 19, beats: 4 });
  });

  it("wraps only at the true endpoint while ordinary playback remains untouched", () => {
    const loop = createDjBeatLoop(10, 120, 4, 40);
    expect(wrapDjBeatLoopTime(10, loop)).toBeNull();
    expect(wrapDjBeatLoopTime(11.99, loop)).toBeNull();
    expect(wrapDjBeatLoopTime(12, loop)).toBe(10);
    expect(wrapDjBeatLoopTime(12.08, loop)).toBe(10);
    expect(wrapDjBeatLoopTime(100, null)).toBeNull();
  });

  it("refuses unverified BPM and invalid media times rather than guessing", () => {
    for (const bpm of [null, 0, 29, 301, Number.NaN, Infinity]) {
      expect(createDjBeatLoop(10, bpm, 4, 60)).toBeNull();
    }
    expect(createDjBeatLoop(-1, 120, 4, 60)).toBeNull();
    expect(createDjBeatLoop(Number.NaN, 120, 4, 60)).toBeNull();
    expect(createDjBeatLoop(5, 120, 5 as unknown as 4 | 8, 60)).toBeNull();
    expect(createDjBeatLoop(5, 120, 4, Number.POSITIVE_INFINITY)).toBeNull();
    expect(createDjBeatLoop(5, 120, 4, 0)).toBeNull();
  });

  it("does not create a loop too near the media end or past its duration", () => {
    expect(createDjBeatLoop(28, 120, 4, 30)).toBeNull();
    expect(createDjBeatLoop(28.1, 120, 4, 30)).toBeNull();
    expect(createDjBeatLoop(27, 120, 4, 30)).toEqual({ start: 27, end: 29, beats: 4 });
    expect(createDjBeatLoop(10, 30, 8, 12)).toBeNull();
  });

  it("exits on an actual manual seek outside the range, not an internal rewind", () => {
    const loop = createDjBeatLoop(10, 120, 4, 40);
    expect(djBeatLoopSeekExits(10, loop)).toBe(false);
    expect(djBeatLoopSeekExits(11, loop)).toBe(false);
    expect(djBeatLoopSeekExits(9, loop)).toBe(true);
    expect(djBeatLoopSeekExits(20, loop)).toBe(true);
    expect(djBeatLoopSeekExits(Number.NaN, loop)).toBe(false);
    expect(djBeatLoopSeekExits(20, null)).toBe(false);
    expect(wrapDjBeatLoopTime(Number.NaN, loop)).toBeNull();
    expect(wrapDjBeatLoopTime(20, { start: 8, end: 8, beats: 4 })).toBeNull();
  });
});
