import {
  assertSafeGeneratedAudioUrl,
  readBoundedGeneratedAudio,
} from "./boundedAudioDownload.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const rejects = async (work: () => Promise<unknown>, pattern: RegExp) => {
  let message = "";
  try { await work(); }
  catch (error) { message = String(error); }
  assert(pattern.test(message), `Expected ${pattern}, got ${message || "success"}`);
};

Deno.test("#4064 accepts only safe provider audio origins", () => {
  assert(assertSafeGeneratedAudioUrl("https://replicate.delivery/file.mp3") ===
    "https://replicate.delivery/file.mp3", "expected HTTPS provider URL");
  for (const url of [
    "http://replicate.delivery/file.mp3",
    "javascript:alert(1)",
    "https://user:token@replicate.delivery/audio.mp3",
    "https://127.0.0.1/internal",
    "https://192.168.0.4/internal",
    "https://localhost/internal",
    "https://[::1]/internal",
  ]) {
    let rejected = false;
    try { assertSafeGeneratedAudioUrl(url); }
    catch { rejected = true; }
    assert(rejected, `Accepted unsafe URL ${url}`);
  }
});

Deno.test("#4064 decodes bounded stream when content length is missing", async () => {
  const output = await readBoundedGeneratedAudio(
    new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200).fill(1));
        controller.enqueue(new Uint8Array(150).fill(2));
        controller.close();
      },
    })), 512);
  assert(output.byteLength === 350 && output[199] === 1 && output[200] === 2,
    "Corrupted streamed MP3 buffer");
});

Deno.test("#4064 rejects oversized content-length before allocating audio", async () => {
  const response = new Response(new Uint8Array(300), {
    headers: { "content-length": "999999" },
  });
  await rejects(() => readBoundedGeneratedAudio(response, 512), /maximum permitted size/);
});

Deno.test("#4064 rejects oversized chunked audio even with no content length", async () => {
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(400).fill(1));
      controller.enqueue(new Uint8Array(400).fill(2));
      controller.close();
    },
  }));
  await rejects(() => readBoundedGeneratedAudio(response, 512), /maximum permitted size/);
});

Deno.test("#4064 rejects empty and incomplete streamed provider MP3", async () => {
  await rejects(() => readBoundedGeneratedAudio(new Response(new Uint8Array(10)), 512),
    /incomplete MP3/);
  await rejects(() => readBoundedGeneratedAudio(new Response(null), 512),
    /empty audio response/);
});
