import { totpRpc } from "./rpc";

export type TotpBandNameAudioStatus = "missing" | "stale" | "recorded";

export interface TotpBandNameAudioCatalogRow {
  band_id: string;
  band_name: string;
  created_at: string | null;
  is_solo_artist: boolean;
  status: TotpBandNameAudioStatus;
  recorded_band_name: string | null;
  audio_url: string | null;
  storage_path: string | null;
  duration_ms: number | null;
  sha256: string | null;
  version: number | null;
  uploaded_at: string | null;
}

export interface SaveTotpBandNameAudioInput {
  bandId: string;
  audioUrl: string;
  storagePath: string;
  durationMs: number;
  sha256: string;
}

export async function getTotpBandNameAudioCatalog(): Promise<TotpBandNameAudioCatalogRow[]> {
  const { data, error } = await totpRpc<TotpBandNameAudioCatalogRow[]>(
    "totp_admin_band_name_audio_catalog",
  );
  if (error) throw new Error(error.message || "Could not load band-name recordings.");
  return Array.isArray(data) ? data : [];
}

export async function saveTotpBandNameAudio(
  input: SaveTotpBandNameAudioInput,
): Promise<TotpBandNameAudioCatalogRow> {
  const { data, error } = await totpRpc<TotpBandNameAudioCatalogRow>(
    "totp_admin_save_band_name_audio",
    {
      p_band_id: input.bandId,
      p_audio_url: input.audioUrl,
      p_storage_path: input.storagePath,
      p_duration_ms: input.durationMs,
      p_sha256: input.sha256,
    },
  );
  if (error) throw new Error(error.message || "Could not save the band-name recording.");
  if (!data) throw new Error("No band-name recording was returned.");
  return data;
}
