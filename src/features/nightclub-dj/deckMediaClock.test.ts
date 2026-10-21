import { describe, expect, it, vi } from "vitest";
import { DJ_PLAYHEAD_REFRESH_MS, watchDjDeckMediaTime } from "./deckMediaClock";
import type { DjVolumeFrameScheduler } from "./djVolumeRamp";

function makeClock() {
  let time = 0;
  let id = 0;
  const frames = new Map<number, (timestamp: number) => void>();
  const clock: DjVolumeFrameScheduler = {
    now: () => time,
    request: (callback) => {
      const next = ++id;
      frames.set(next, callback);
      return next;
    },
    cancel: (handle) => { frames.delete(handle); },
  };
  return {
    clock,
    step(timestamp: number) {
      time = timestamp;
      const pending = [...frames.values()];
      frames.clear();
      for (const frame of pending) frame(timestamp);
    },
    pending: () => frames.size,
  };
}

describe("DJ playhead reads the real HTML audio clock", () => {
  it("updates the waveform and beat guide at a bounded cadence, never inventing audio time", () => {
    const frames = makeClock();
    const media = { currentTime: 7.2, paused: false };
    const publish = vi.fn();
    const cleanup = watchDjDeckMediaTime(media, frames.clock, publish);
    expect(publish).toHaveBeenCalledWith(7.2);
    expect(frames.pending()).toBe(1);

    media.currentTime = 7.3;
    frames.step(DJ_PLAYHEAD_REFRESH_MS - 1);
    expect(publish).toHaveBeenCalledTimes(1);

    media.currentTime = 7.38;
    frames.step(DJ_PLAYHEAD_REFRESH_MS);
    expect(publish).toHaveBeenLastCalledWith(7.38);
    expect(publish).toHaveBeenCalledTimes(2);

    media.currentTime = 22.5; // User seeks with platter or hot cue.
    frames.step(DJ_PLAYHEAD_REFRESH_MS * 2);
    expect(publish).toHaveBeenLastCalledWith(22.5);
    cleanup();
    expect(frames.pending()).toBe(0);
    frames.step(DJ_PLAYHEAD_REFRESH_MS * 3);
    expect(publish).toHaveBeenCalledTimes(3);
  });

  it("stops polling once native playback pauses; returning to Play needs a new binding", () => {
    const frames = makeClock();
    const media = { currentTime: 4, paused: false };
    const publish = vi.fn();
    const cleanup = watchDjDeckMediaTime(media, frames.clock, publish);
    media.paused = true;
    frames.step(DJ_PLAYHEAD_REFRESH_MS);
    expect(frames.pending()).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    cleanup();

    media.paused = false;
    media.currentTime = 6;
    const cleanupAgain = watchDjDeckMediaTime(media, frames.clock, publish);
    expect(publish).toHaveBeenLastCalledWith(6);
    cleanupAgain();
  });

  it("falls back to timeupdate when requestAnimationFrame is absent or media is paused", () => {
    const frames = makeClock();
    const publish = vi.fn();
    const media = { currentTime: 0, paused: true };
    watchDjDeckMediaTime(media, frames.clock, publish)();
    expect(frames.pending()).toBe(0);
    media.paused = false;
    watchDjDeckMediaTime(media, null, publish)();
    expect(publish).not.toHaveBeenCalled();
  });

  it("never publishes invalid player positions and recovers when playback becomes finite", () => {
    const frames = makeClock();
    const media = { currentTime: Number.NaN, paused: false };
    const publish = vi.fn();
    const cleanup = watchDjDeckMediaTime(media, frames.clock, publish);
    expect(publish).not.toHaveBeenCalled();
    frames.step(80);
    expect(publish).not.toHaveBeenCalled();
    media.currentTime = 8.75;
    frames.step(160);
    expect(publish).toHaveBeenCalledWith(8.75);
    cleanup();
  });
});
