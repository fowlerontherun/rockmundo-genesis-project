import { afterEach, describe, expect, it, vi } from "vitest";
import { readAudioDuration } from "../audioDurationAudit";

class FakeAudio {
  duration = Infinity;
  src = "";
  preload = "";
  paused = false;
  removed = false;
  private listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string) { this.listeners.get(type)?.forEach(listener => listener()); }
  load() {}
  pause() { this.paused = true; }
  removeAttribute(name: string) { if (name === "src") this.removed = true; }
}

describe("decoded MP3 duration health check", () => {
  let audio: FakeAudio;
  afterEach(() => { vi.unstubAllGlobals(); });

  function start() {
    vi.stubGlobal("Audio", class extends FakeAudio { constructor() { super(); audio = this; } });
    return readAudioDuration("/song.mp3", 2000);
  }

  it("does not misclassify an initial Infinity duration; waits for finite VBR metadata", async () => {
    const result = start();
    let finished = false;
    void result.then(() => { finished = true; });
    audio.emit("loadedmetadata");
    await Promise.resolve();
    expect(finished).toBe(false);
    audio.duration = 193.2;
    audio.emit("durationchange");
    expect(await result).toBe(193.2);
    expect(audio.paused).toBe(true);
    expect(audio.removed).toBe(true);
  });

  it("aborts a metadata request and returns unknown without a paid retry", async () => {
    const controller = new AbortController();
    vi.stubGlobal("Audio", class extends FakeAudio { constructor() { super(); audio = this; } });
    const result = readAudioDuration("/song.mp3", 2000, controller.signal);
    controller.abort();
    expect(await result).toBe(null);
    expect(audio.paused).toBe(true);
    expect(audio.removed).toBe(true);
  });

  it("does not allocate audio elements if the caller is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const constructor = vi.fn();
    vi.stubGlobal("Audio", constructor);
    expect(await readAudioDuration("/song.mp3", 2000, controller.signal)).toBe(null);
    expect(constructor).not.toHaveBeenCalled();
  });
});
