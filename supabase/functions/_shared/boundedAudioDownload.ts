/**
 * Provider MP3s must be validated before writing a song. Cap downloads before
 * allocating the full response, even when Content-Length is absent or false.
 * 32 MiB accommodates a six-minute 320 kbps song with substantial headroom.
 */
export const MAX_GENERATED_MP3_BYTES = 32 * 1024 * 1024;

export function assertSafeGeneratedAudioUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error("Provider returned an invalid audio URL"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
      /[\\\s]/.test(value) || url.hostname === "localhost" ||
      /(?:^|\.)localhost$/.test(url.hostname) ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(url.hostname) ||
      /^\[(?:::1|fc[0-9a-f:]*|fd[0-9a-f:]*|fe80:[0-9a-f:]*)\]$/i.test(url.hostname)) {
    throw new Error("Provider returned an unsafe audio URL");
  }
  return url.href;
}

export async function readBoundedGeneratedAudio(
  response: Response,
  maxBytes = MAX_GENERATED_MP3_BYTES,
): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`Provider audio download failed: HTTP ${response.status}`);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Invalid audio size limit");

  const claimed = response.headers.get("content-length");
  if (claimed !== null) {
    const number = Number(claimed);
    if (!Number.isSafeInteger(number) || number < 0 || number > maxBytes)
      throw new Error("Provider audio exceeds the maximum permitted size");
  }
  if (!response.body) throw new Error("Provider returned an empty audio response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Provider audio exceeds the maximum permitted size");
      chunks.push(value);
    }
    if (total < 256) throw new Error("Provider returned incomplete MP3 audio");
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined;
  } finally {
    // Also release provider connections on malformed or oversized bodies.
    try { await reader.cancel(); } catch { /* already consumed/cancelled */ }
    reader.releaseLock();
  }
}
