import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrowdAudioManager } from "./CrowdAudioManager";

class FakeParam {
  value = 1;
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}
class FakeContext {
  static created: FakeContext[] = [];
  state: AudioContextState = "running";
  currentTime = 0;
  destination = new FakeNode();
  nodes: FakeNode[] = [];
  compressor = new FakeCompressor();
  constructor() { FakeContext.created.push(this); }
  createGain() { const node = new FakeNode(); this.nodes.push(node); return node; }
  createDynamicsCompressor() { return this.compressor; }
  createMediaElementSource() { return new FakeNode(); }
  resume = vi.fn(async () => { this.state = "running"; });
  close = vi.fn(async () => { this.state = "closed"; });
}
class FakeAudio {
  static created: FakeAudio[] = [];
  static rejectPlay = false;
  paused = true;
  crossOrigin = "";
  preload = "";
  loop = false;
  volume = 1;
  currentTime = 0;
  onended: (() => void) | null = null;
  src: string;
  constructor(url: string) { this.src = url; FakeAudio.created.push(this); }
  addEventListener = vi.fn();
  play = vi.fn(async () => { if (FakeAudio.rejectPlay) throw Error("autoplay blocked"); this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  removeAttribute = vi.fn((attr: string) => { if (attr === "src") this.src = ""; });
}
const clip = (id: string, loopable = false) => ({
  id, url: `https://storage.test/${id}.mp3`, loopable,
  fadeInMs: 100, fadeOutMs: 250, durationSeconds: 10, gainDb: -9,
});
let manager: CrowdAudioManager;
beforeEach(() => {
  FakeContext.created = [];
  FakeAudio.created = [];
  FakeAudio.rejectPlay = false;
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", FakeContext);
  vi.useFakeTimers();
  manager = new CrowdAudioManager();
});
afterEach(() => {
  manager.dispose();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("shared crowd Web Audio mixer", () => {
  it("has exactly one active loop and crossfades when ambience changes", async () => {
    expect(await manager.setAmbience(clip("pub", true))).toBe(true);
    expect(await manager.setAmbience(clip("pub", true))).toBe(true);
    expect(FakeAudio.created).toHaveLength(1);
    expect(await manager.setAmbience(clip("club", true))).toBe(true);
    expect(FakeAudio.created).toHaveLength(2);
    expect(FakeAudio.created[0].paused).toBe(false);
    vi.advanceTimersByTime(300);
    expect(FakeAudio.created[0].paused).toBe(true);
    expect(FakeAudio.created[1].paused).toBe(false);
  });

  it("plays one primary reaction, uses cue-time cooldown and supports deterministic rewind", async () => {
    expect(await manager.playReaction(clip("cheer"), 1000)).toBe(true);
    expect(await manager.playReaction(clip("cheer"), 2000)).toBe(false);
    expect(FakeAudio.created).toHaveLength(1);
    expect(await manager.playReaction(clip("applause"), 3000)).toBe(true);
    vi.advanceTimersByTime(300);
    expect(FakeAudio.created[0].paused).toBe(true);
    expect(FakeAudio.created[1].paused).toBe(false);
    expect(await manager.playReaction(clip("cheer"), 16000)).toBe(true);
    manager.stop();
    expect(await manager.playReaction(clip("cheer"), 1000)).toBe(true);
  });

  it("only changes crowd bus gain; dialogue and music are untouched and a limiter is wired", async () => {
    manager.prime();
    const ctx = FakeContext.created[0];
    const music = ctx.nodes[1].gain;
    const dialogue = ctx.nodes[2].gain;
    const ambience = ctx.nodes[3].gain;
    const reaction = ctx.nodes[4].gain;
    const musicGain = music.value;
    const dialogueGain = dialogue.value;
    manager.setCrowdVolume(.8);
    expect(ambience.value).toBe(.8);
    expect(reaction.value).toBe(.8);
    manager.setDialogueActive(true);
    expect(ambience.value).toBeCloseTo(.224);
    expect(reaction.value).toBeCloseTo(.32);
    manager.setDialogueActive(false);
    expect(ambience.value).toBe(.8);
    expect(music.value).toBe(musicGain);
    expect(dialogue.value).toBe(dialogueGain);
    expect(ctx.compressor.threshold.value).toBe(-9);
    expect(ctx.compressor.ratio.value).toBe(12);
    expect(ctx.nodes[0].gain.value).toBeLessThan(1);
    manager.setCrowdVolume(0);
    expect(ambience.value).toBe(0);
    expect(reaction.value).toBe(0);
  });

  it("stops all sources, timers and graph nodes on viewer exit", async () => {
    await manager.setAmbience(clip("studio", true));
    await manager.playReaction(clip("applause"), 100);
    manager.dispose();
    expect(FakeAudio.created.every((audio) => audio.paused && !audio.src)).toBe(true);
    expect(FakeContext.created[0].close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20000);
    expect(FakeAudio.created.every((audio) => audio.paused)).toBe(true);
  });

  it("does not consume cooldown after autoplay rejection or invalid asset URLs", async () => {
    expect(await manager.playReaction({ id: "unsafe", url: "javascript:alert(1)" }, 100)).toBe(false);
    const failed = clip("failure");
    FakeAudio.rejectPlay = true;
    expect(await manager.playReaction(failed, 100)).toBe(false);
    FakeAudio.rejectPlay = false;
    expect(await manager.playReaction(failed, 100)).toBe(true);
  });

  it("isolates routes with distinct owner tokens", async () => {
    const gig = Symbol("gig");
    const studio = Symbol("studio");
    manager.claim(gig);
    await manager.setAmbience(clip("gig", true));
    manager.claim(studio);
    expect(FakeAudio.created[0].paused).toBe(true);
    await manager.setAmbience(clip("studio", true));
    manager.releaseOwner(gig);
    expect(FakeAudio.created[1].paused).toBe(false);
    manager.releaseOwner(studio);
    expect(FakeAudio.created[1].paused).toBe(true);
  });
});
