import { describe, expect, it, vi } from "vitest";
import { equalPowerCrossfade } from "./mixerMath";
import { DJ_CROSSFADE_RAMP_MS, djCombinedDeckVolume, rampDjDeckVolume, type DjVolumeFrameScheduler } from "./djVolumeRamp";

function fakeFrames() {
  let ms = 0;
  let nextId = 1;
  const callbacks = new Map<number, (t: number) => void>();
  const scheduler: DjVolumeFrameScheduler = {
    now: () => ms,
    request: (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel: (id) => { callbacks.delete(id); },
  };
  return {
    scheduler,
    tick(time: number) {
      ms = time;
      const entries = [...callbacks.entries()];
      callbacks.clear();
      for (const [, callback] of entries) callback(time);
    },
    count: () => callbacks.size,
  };
}

describe("DJ native-audio crossfader gain smoothing", () => {
  it("preserves realistic controller channel trims alongside equal-power fader levels", () => {
    const center = equalPowerCrossfade(50);
    expect(djCombinedDeckVolume(center.a, 100)).toBeCloseTo(center.a);
    expect(djCombinedDeckVolume(center.b, 50)).toBeCloseTo(center.b / 2);
    expect(djCombinedDeckVolume(.7, 0)).toBe(0);
    expect(djCombinedDeckVolume(.7, 150)).toBeCloseTo(.7);
    expect(djCombinedDeckVolume(.7, -1)).toBe(0);
    expect(djCombinedDeckVolume(.7, Number.NaN)).toBe(0);
    expect(djCombinedDeckVolume(Number.NaN, 90)).toBe(0);
  });

  it("ramps each deck smoothly with zero-slope endpoints and no amplification", () => {
    const f = fakeFrames();
    const a = { volume: .7, paused: false };
    rampDjDeckVolume(a, 0, f.scheduler);
    f.tick(0);
    expect(a.volume).toBeCloseTo(.7);
    f.tick(DJ_CROSSFADE_RAMP_MS / 2);
    expect(a.volume).toBeCloseTo(.35);
    f.tick(DJ_CROSSFADE_RAMP_MS);
    expect(a.volume).toBe(0);
    expect(f.count()).toBe(0);
  });

  it("synchronizes equal-power targets from the same frame without exceeding headroom", () => {
    const f = fakeFrames();
    const a = { volume: .7, paused: false };
    const b = { volume: 0, paused: false };
    const target = equalPowerCrossfade(50);
    rampDjDeckVolume(a, target.a, f.scheduler);
    rampDjDeckVolume(b, target.b, f.scheduler);
    f.tick(45);
    expect(a.volume).toBeGreaterThan(target.a);
    expect(b.volume).toBeLessThan(target.b);
    f.tick(90);
    expect(a.volume).toBeCloseTo(target.a);
    expect(b.volume).toBeCloseTo(target.b);
    expect(Math.max(a.volume, b.volume)).toBeLessThan(.71);
  });

  it("cancels stale animation mid-drag and starts the next fade at actual current volume", () => {
    const f = fakeFrames();
    const player = { volume: .7, paused: false };
    const first = rampDjDeckVolume(player, 0, f.scheduler);
    f.tick(45);
    expect(player.volume).toBeCloseTo(.35);
    first();
    expect(f.count()).toBe(0);
    rampDjDeckVolume(player, .7, f.scheduler);
    f.tick(90);
    expect(player.volume).toBeCloseTo(.525);
    f.tick(135);
    expect(player.volume).toBeCloseTo(.7);
  });

  it("sets gain immediately when paused, no browser frame clock, or zero ramp duration", () => {
    const f = fakeFrames();
    const paused = { volume: .7, paused: true };
    rampDjDeckVolume(paused, 0, f.scheduler);
    expect(paused.volume).toBe(0);
    expect(f.count()).toBe(0);
    const unsupported = { volume: .5, paused: false };
    rampDjDeckVolume(unsupported, .2, null);
    expect(unsupported.volume).toBe(.2);
    rampDjDeckVolume(unsupported, .6, f.scheduler, 0);
    expect(unsupported.volume).toBe(.6);
  });

  it("clamps invalid and excessive targets, and cleanup removes pending animation", () => {
    const f = fakeFrames();
    const player = { volume: .7, paused: false };
    const cancel = rampDjDeckVolume(player, 50, f.scheduler);
    f.tick(90);
    expect(player.volume).toBe(1);
    cancel();
    const cancel2 = rampDjDeckVolume(player, Number.NaN, f.scheduler);
    cancel2();
    expect(f.count()).toBe(0);
    expect(player.volume).toBe(1);
    const fallback = { volume: .7, paused: true };
    rampDjDeckVolume(fallback, Number.NaN, f.scheduler);
    expect(fallback.volume).toBe(0);
  });

  it("never schedules an animation when the destination already matches the volume", () => {
    const f = fakeFrames();
    const player = { volume: .7, paused: false };
    const spy = vi.spyOn(f.scheduler, "request");
    rampDjDeckVolume(player, .7, f.scheduler);
    expect(spy).not.toHaveBeenCalled();
  });
});
