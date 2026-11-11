import { afterEach, describe, expect, it, vi } from "vitest";
import { readAudioDuration } from "../audioDurationAudit";

function mp3Frames() {
  // MPEG-1 Layer III, 44.1 kHz, alternating 128 and 192 kbps.
  const bytes = new Uint8Array(417 + 626 + 417);
  bytes.set([0xff, 0xfb, 0x90, 0x64], 0);
  bytes.set([0xff, 0xfb, 0xb0, 0x64], 417);
  bytes.set([0xff, 0xfb, 0x90, 0x64], 417 + 626);
  return bytes;
}

afterEach(() => vi.unstubAllGlobals());

describe("stored MP3 frame audit", () => {
  it("measures variable-bitrate frames without a content length", async () => {
    const bytes = mp3Frames();
    const fetchAudio = vi.fn(async () => new Response(bytes));
    vi.stubGlobal("fetch", fetchAudio);

    expect(await readAudioDuration("/song.mp3")).toBeCloseTo(3 * 1152 / 44100);
    expect(fetchAudio).toHaveBeenCalledWith("/song.mp3", {
      credentials: "omit",
      signal: expect.any(AbortSignal),
    });
  });

  it("treats a partial frame as unverifiable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(mp3Frames().slice(0, -1))));
    expect(await readAudioDuration("/truncated.mp3")).toBeNull();
  });

  it("cancels an in-flight download when the audit is aborted", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url, { signal }: RequestInit) => new Promise<Response>((_, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    })));

    const duration = readAudioDuration("/song.mp3", 12000, controller.signal);
    controller.abort();
    expect(await duration).toBeNull();
  });
});
