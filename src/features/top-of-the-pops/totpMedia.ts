import { supabase } from "@/integrations/supabase/client";

export const TOTP_MEDIA_BUCKET = "totp-media";

export type TotpPresenterAudioSlot = "opening" | "chart" | "act-intro" | "between" | "closing";

export const TOTP_MEDIA_PATHS = {
  programmeIntro: "programme/intro",
  presenter: (presenterKey: string, slot: TotpPresenterAudioSlot) => `presenters/${presenterKey}/${slot}`,
  chartPositionFolder: (presenterKey: string) => `presenters/${presenterKey}/chart-positions`,
  chartPosition: (presenterKey: string, rank: number, revision: string, extension: string) => `presenters/${presenterKey}/chart-positions/${rank}-${revision}.${extension}`,
  reusablePhraseFolder: (presenterKey: string) => `presenters/${presenterKey}/reusable-phrases`,
  reusablePhrase: (presenterKey: string, phraseId: string, revision: string, extension: string) => `presenters/${presenterKey}/reusable-phrases/${phraseId}-${revision}.${extension}`,
} as const;

export function totpMediaPublicUrl(path: string): string {
  return supabase.storage.from(TOTP_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function detectTotpUploadMime(file: File): Promise<string> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isWebM = header.length >= 4
    && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  if (isWebM) return file.type.startsWith("audio/") ? "audio/webm" : "video/webm";

  const ascii = String.fromCharCode(...header);
  if (ascii.includes("ftyp")) return file.type.startsWith("audio/") ? "audio/mp4" : "video/mp4";
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) return "audio/mpeg";
  if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (ascii.startsWith("RIFF")) return "audio/wav";
  if (ascii.startsWith("OggS")) return "audio/ogg";
  return file.type || "application/octet-stream";
}
