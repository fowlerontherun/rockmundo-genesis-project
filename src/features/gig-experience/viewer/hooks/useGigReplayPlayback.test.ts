import { describe, expect, it } from "vitest";
import { ReplayClock } from "../engine/PlaybackController";
import { UI_TICK_INTERVAL_MS, replayUiTickDue } from "./useGigReplayPlayback";

describe("gig replay rendering cadence", () => {
  it("only asks React to render approximately 20 times a second while playing", () => {
    expect(UI_TICK_INTERVAL_MS).toBe(50);
    expect(replayUiTickDue(16, 0)).toBe(false);
    expect(replayUiTickDue(33, 0)).toBe(false);
    expect(replayUiTickDue(50, 0)).toBe(true);
    expect(replayUiTickDue(83, 50)).toBe(false);
    expect(replayUiTickDue(100, 50)).toBe(true);
  });

  it("seeking, switching songs and restarting change the underlying clock immediately", () => {
    let now = 1_000;
    const clock = new ReplayClock(180_000, () => now);
    clock.play();
    now += 16;
    clock.seek(90_000);
    expect(clock.position()).toBe(90_000);
    clock.seek(25_000);
    expect(clock.position()).toBe(25_000);
    clock.restart();
    expect(clock.position()).toBe(0);
    now += 25;
    expect(clock.position()).toBe(25);
    clock.pause();
    expect(clock.isPlaying()).toBe(false);
  });
});
