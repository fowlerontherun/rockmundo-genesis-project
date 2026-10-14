/** Browser-reported duration of an existing audio recording. Never mutates files. */
export async function readAudioDuration(url: string, timeoutMs = 12000): Promise<number | null> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = "metadata";
    let settled = false;
    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };
    const loaded = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    const failed = () => finish(null);
    const timer = window.setTimeout(failed, timeoutMs);
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("error", failed);
    audio.src = url;
    audio.load();
  });
}

export function isGeneratedAudioShort(actualSeconds: number, expectedSeconds: number | null): boolean {
  return expectedSeconds !== null && Number.isFinite(expectedSeconds) && expectedSeconds > 0 &&
    actualSeconds < Math.max(30, expectedSeconds * 0.8);
}

export function formatAudioDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "Unknown";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
