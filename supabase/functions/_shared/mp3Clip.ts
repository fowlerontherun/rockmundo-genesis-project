import { getMp3DurationSeconds } from "./mp3Duration.ts";

/**
 * Trim fully validated MP3 audio to <=90 seconds at a complete MPEG III
 * frame boundary, without another paid provider generation or re-encoding.
 * Only trim audio that already passes the existing frame-duration validator.
 */
export function clipLongMp3ToSeconds(bytes: Uint8Array, maxSeconds = 90): Uint8Array {
  if (!Number.isFinite(maxSeconds) || maxSeconds < 60 || maxSeconds > 90) throw new Error("Invalid MP3 target length");
  const duration = getMp3DurationSeconds(bytes);
  if (duration === null) throw new Error("Invalid or truncated MP3");
  if (duration <= maxSeconds) return bytes;
  let start = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    start = 10 + (bytes[6] << 21 | bytes[7] << 14 | bytes[8] << 7 | bytes[9])
      + ((bytes[5] & 16) ? 10 : 0);
  }
  type Frame = { size: number; samples: number; rate: number; version: number };
  const frameAt = (p: number): Frame | null => {
    if (p + 4 > bytes.length || bytes[p] !== 255 || (bytes[p+1] & 224) !== 224) return null;
    const a = bytes[p+1], b = bytes[p+2];
    const version = (a >> 3) & 3, layer = (a >> 1) & 3;
    const rateIndex = (b >> 2) & 3, bitrateIndex = (b >> 4) & 15;
    if (version === 1 || layer !== 1 || rateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) return null;
    const bitrate = (version === 3
      ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]
      : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrateIndex];
    const rate = (version === 3 ? [44100,48000,32000]
      : version === 2 ? [22050,24000,16000] : [11025,12000,8000])[rateIndex];
    const samples = version === 3 ? 1152 : 576;
    const size = Math.floor((version === 3 ? 144000 : 72000) * bitrate / rate + ((b >> 1) & 1));
    return size >= 24 ? { size, samples, rate, version } : null;
  };
  let first = -1;
  for (let p = start; p + 8 < bytes.length && p < start + 65536; p++) {
    const f = frameAt(p);
    if (f && frameAt(p + f.size)?.rate === f.rate) { first = p; break; }
  }
  if (first < 0) throw new Error("No valid MP3 frames");
  const initial = frameAt(first)!;
  let end = first, sampleCount = 0, frames = 0;
  while (end < bytes.length) {
    const f = frameAt(end);
    if (!f || f.rate !== initial.rate || f.version !== initial.version
      || end + f.size > bytes.length || (sampleCount + f.samples) / initial.rate > maxSeconds) break;
    sampleCount += f.samples;
    frames++;
    end += f.size;
  }
  if (sampleCount / initial.rate < 60 || frames < 2) throw new Error("Cannot make a 60–90s MP3 clip");
  const clipped = bytes.slice(first, end); // Drop original ID3 and duration metadata.
  const mono = ((clipped[3] >> 6) & 3) === 3, hasCrc = (clipped[1] & 1) === 0;
  const xing = 4 + (hasCrc ? 2 : 0)
    + (initial.version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
  const tag = String.fromCharCode(...clipped.subarray(xing, xing + 4));
  // Xing/Info VBR headers encode original frame and byte counts. Update them
  // so players seek using the new clip length, not the provider's longer file.
  if (tag === "Xing" || tag === "Info") {
    const flags = clipped[xing+4]*0x1000000 + (clipped[xing+5]<<16)
      + (clipped[xing+6]<<8) + clipped[xing+7];
    const writeU32 = (p: number, n: number) => {
      clipped[p] = n >>> 24; clipped[p+1] = (n >>> 16) & 255;
      clipped[p+2] = (n >>> 8) & 255; clipped[p+3] = n & 255;
    };
    let pos = xing + 8;
    if (flags & 1) { writeU32(pos,frames); pos+=4; }
    if (flags & 2) writeU32(pos,clipped.length);
  }
  const confirmed = getMp3DurationSeconds(clipped);
  if (confirmed === null || confirmed < 60 || confirmed > 90) throw new Error("Clipped MP3 failed validation");
  return clipped;
}
