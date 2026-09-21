export function totpAudioFileExtension(mime: string): string {
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

export async function totpAudioSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function totpAudioDurationMs(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      const cleanup = () => {
        audio.removeAttribute("src");
        audio.load();
      };
      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration * 1000);
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error("Could not measure the recording duration."));
        } else {
          resolve(duration);
        }
      };
      audio.onerror = () => {
        cleanup();
        reject(new Error("The selected recording could not be decoded."));
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}


export async function totpRemoteAudioDurationMs(url: string): Promise<number> {
  const normalized = url.trim();
  if (!normalized) throw new Error("Could not measure an empty audio URL.");

  return await new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
    };
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration * 1000);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not measure the reusable presenter recording duration."));
      } else {
        resolve(duration);
      }
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("The reusable presenter recording could not be decoded."));
    };
    audio.src = normalized;
  });
}


export async function totpRemoteAudioSha256(url: string): Promise<string> {
  const normalized = url.trim();
  if (!normalized) throw new Error("Could not hash an empty audio URL.");
  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error(`Could not load reusable presenter audio for hashing (HTTP ${response.status}).`);
  }
  const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
