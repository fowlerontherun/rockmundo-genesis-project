/**
 * Calculate playback length from MPEG Layer III audio frames, not file size.
 * Supports MPEG-1, MPEG-2 and MPEG-2.5 (CBR and VBR). Returns null when
 * the supplied bytes cannot be verified as complete MP3 frames.
 */
export function getMp3DurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 256) return null;

  let start = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    if (bytes.length < 10 || (bytes[6] | bytes[7] | bytes[8] | bytes[9]) & 0x80) return null;
    const tagSize = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    start = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
  }

  type Frame = { size: number; samples: number; sampleRate: number; version: number };
  const frameAt = (offset: number): Frame | null => {
    if (offset + 4 > bytes.length) return null;
    const b0 = bytes[offset], b1 = bytes[offset + 1], b2 = bytes[offset + 2];
    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
    const version = (b1 >> 3) & 3;
    const layer = (b1 >> 1) & 3;
    const rateIndex = (b2 >> 2) & 3;
    const bitrateIndex = (b2 >> 4) & 15;
    if (version === 1 || layer !== 1 || rateIndex === 3 ||
        bitrateIndex === 0 || bitrateIndex === 15) return null;
    const bitrates = version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const rates = version === 3 ? [44100, 48000, 32000]
      : version === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
    const sampleRate = rates[rateIndex];
    const samples = version === 3 ? 1152 : 576;
    const size = Math.floor((version === 3 ? 144000 : 72000) *
      bitrates[bitrateIndex] / sampleRate + ((b2 >> 1) & 1));
    return size >= 24 ? { size, samples, sampleRate, version } : null;
  };

  // Avoid mistaking a byte sequence inside metadata for the first audio frame.
  let offset = -1;
  for (let i = start; i + 8 < bytes.length && i < start + 65536; i++) {
    const first = frameAt(i);
    if (first && frameAt(i + first.size)?.sampleRate === first.sampleRate) {
      offset = i;
      break;
    }
  }
  if (offset < 0) return null;

  const initial = frameAt(offset)!;
  let frames = 0;
  let samples = 0;
  while (offset < bytes.length) {
    const frame = frameAt(offset);
    if (!frame || frame.sampleRate !== initial.sampleRate ||
        frame.version !== initial.version || offset + frame.size > bytes.length) break;
    offset += frame.size;
    samples += frame.samples;
    frames++;
  }
  // Permit a small trailer (e.g. ID3v1 / encoder padding), not missing audio frames.
  if (frames < 2 || bytes.length - offset > 1024) return null;
  const seconds = samples / initial.sampleRate;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
