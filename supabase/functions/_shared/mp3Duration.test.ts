import { getMp3DurationSeconds } from "./mp3Duration.ts";

function makeMp3(bitrateIndices: number[], withId3 = false): Uint8Array {
  const frames = bitrateIndices.map(index => {
    const kbps = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320][index];
    const size = Math.floor(144000 * kbps / 44100);
    const frame = new Uint8Array(size);
    frame.set([0xff, 0xfb, index << 4, 0x64], 0);
    return frame;
  });
  const id3 = withId3 ? new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0)]) : new Uint8Array();
  const data = new Uint8Array(id3.length + frames.reduce((n, frame) => n + frame.length, 0));
  data.set(id3);
  let offset = id3.length;
  for (const frame of frames) { data.set(frame, offset); offset += frame.length; }
  return data;
}

Deno.test("reports MP3 duration from CBR frames accurately", () => {
  const duration = getMp3DurationSeconds(makeMp3(new Array(500).fill(9)));
  const expected = 500 * 1152 / 44100;
  if (duration === null || Math.abs(duration - expected) > 0.01) {
    throw new Error(`Expected ${expected}s, got ${duration}s`);
  }
});

Deno.test("handles VBR frames and ID3v2 tag", () => {
  const duration = getMp3DurationSeconds(makeMp3(Array.from({ length: 300 }, (_, index) => index % 2 ? 11 : 9), true));
  const expected = 300 * 1152 / 44100;
  if (duration === null || Math.abs(duration - expected) > 0.01) {
    throw new Error(`Expected ${expected}s, got ${duration}s`);
  }
});

Deno.test("rejects corrupt or incomplete audio", () => {
  if (getMp3DurationSeconds(new Uint8Array(2048)) !== null) throw new Error("Accepted invalid MP3");
  const complete = makeMp3(new Array(100).fill(9));
  const truncated = complete.subarray(0, complete.length - 3000);
  if (getMp3DurationSeconds(truncated) !== null) throw new Error("Accepted unfinished MP3 frames");
});
