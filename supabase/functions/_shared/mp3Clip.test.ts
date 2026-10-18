import { describe, expect, it } from "vitest";
import { clipLongMp3ToSeconds } from "./mp3Clip.ts";
import { getMp3DurationSeconds } from "./mp3Duration.ts";

// MPEG-1 Layer III, stereo, 44.1kHz, 128kbps, 1152 samples per frame.
const SIZE = 417;
const RATE = 44100;
const SAMPLES = 1152;
function makeMp3(durationSeconds: number, withXing = false): Uint8Array {
  const frames = Math.ceil(durationSeconds * RATE / SAMPLES);
  const bytes = new Uint8Array(frames * SIZE);
  for (let n = 0; n < frames; n++) {
    const p = n * SIZE;
    bytes[p] = 0xff; bytes[p+1] = 0xfb; bytes[p+2] = 0x90; bytes[p+3] = 0;
  }
  if (withXing) {
    const data = new TextEncoder().encode("Xing");
    bytes.set(data,36); // Four-byte header + 32 bytes of stereo side-info.
    bytes.set([0,0,0,3],40); // frames and bytes count present
    const write = (p:number,v:number) => {
      bytes[p] = v >>> 24; bytes[p+1] = v >>> 16 & 255;
      bytes[p+2] = v >>> 8 & 255; bytes[p+3] = v & 255;
    };
    write(44,frames);write(48,bytes.length);
  }
  return bytes;
}
const getU32=(b:Uint8Array,p:number) =>
  ((b[p]*0x1000000)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0;

describe("paid AI song MP3 preservation", () => {
  it("trims 130 seconds to <=90 without regenerating or re-encoding", () => {
    const source = makeMp3(130);
    const result = clipLongMp3ToSeconds(source,90);
    const seconds = getMp3DurationSeconds(result);
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeGreaterThanOrEqual(60);
    expect(seconds!).toBeLessThanOrEqual(90);
    expect(result.length).toBeLessThan(source.length);
    expect(getMp3DurationSeconds(source)).toBeGreaterThan(129);
  });

  it("rewrites Xing duration fields for seekable variable-bitrate files", () => {
    const source = makeMp3(100,true);
    const output = clipLongMp3ToSeconds(source,90);
    expect(String.fromCharCode(...output.slice(36,40))).toBe("Xing");
    expect(getU32(output,44)).toBe(output.length / SIZE);
    expect(getU32(output,48)).toBe(output.length);
    expect(getU32(output,44)).toBeLessThan(getU32(source,44));
  });

  it("preserves a valid 75-second output byte for byte", () => {
    const source = makeMp3(75);
    expect(clipLongMp3ToSeconds(source)).toBe(source);
  });

  it("rejects partial and invalid MP3 input", () => {
    const original = makeMp3(100);
    expect(() => clipLongMp3ToSeconds(original.subarray(0,original.length-15))).toThrow();
    expect(() => clipLongMp3ToSeconds(new Uint8Array(20))).toThrow();
  });
});
