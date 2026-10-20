import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { selectCrowdCue, type CrowdAudioAsset, type CrowdCueRequest, type CrowdCategory, type CrowdEnvironment, type CrowdSize } from "@/features/gig-experience/audio/crowdCueSelection";
import type { CrowdPlaybackClip } from "./CrowdAudioManager";

/** Boundary for the forward migration, until generated Database types are refreshed. */
const catalogueDb = supabase as unknown as SupabaseClient;

export interface CuratedCrowdAsset extends CrowdAudioAsset {
  name: string;
  storage_path: string;
  duration_seconds: number | null;
  loopable: boolean;
  gain_db: number;
  fade_in_ms: number;
  fade_out_ms: number;
  cue_start_seconds: number;
  cue_end_seconds: number | null;
  source_notes: string | null;
}
const CATEGORIES = new Set<CrowdCategory>(["ambient", "applause", "cheer", "encore", "finale", "reaction"]);
const SIZES = new Set<CrowdSize>(["small", "medium", "large", "any"]);
const ENVIRONMENTS = new Set<CrowdEnvironment>(["pub", "club", "indoor", "arena", "festival", "outdoor", "studio", "any"]);

function validPath(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 && path.length < 512 &&
    !path.startsWith("/") && !path.includes("..") && !path.includes("\\") && /^[a-zA-Z0-9/_ .-]+$/.test(path);
}
function readAsset(row: Record<string, unknown>): CuratedCrowdAsset | null {
  if (!validPath(row.storage_path) || typeof row.id !== "string" || typeof row.name !== "string" ||
      !CATEGORIES.has(row.category as CrowdCategory) || !SIZES.has(row.crowd_size as CrowdSize) ||
      !Array.isArray(row.environments) || !row.environments.length ||
      !row.environments.every((value) => ENVIRONMENTS.has(value)) ||
      row.enabled !== true || row.rights_confirmed !== true) return null;
  const intensity = Number(row.intensity);
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 5) return null;
  return {
    id: row.id, name: row.name, storage_path: row.storage_path,
    category: row.category as CrowdCategory, crowd_size: row.crowd_size as CrowdSize,
    environments: row.environments as CrowdEnvironment[], intensity,
    enabled: true, rights_confirmed: true,
    duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    loopable: row.loopable === true,
    gain_db: Number(row.gain_db ?? -9), fade_in_ms: Number(row.fade_in_ms ?? 100),
    fade_out_ms: Number(row.fade_out_ms ?? 250),
    cue_start_seconds: Number(row.cue_start_seconds ?? 0),
    cue_end_seconds: row.cue_end_seconds == null ? null : Number(row.cue_end_seconds),
    source_notes: typeof row.source_notes === "string" ? row.source_notes : null,
  };
}

let cache: CuratedCrowdAsset[] | null = null;
let pending: Promise<CuratedCrowdAsset[]> | null = null;

export async function loadCuratedCrowdAssets(): Promise<CuratedCrowdAsset[]> {
  if (cache) return cache;
  if (pending) return pending;
  pending = (async () => {
    const { data, error } = await catalogueDb
      .from("crowd_audio_assets")
      .select("id,name,storage_path,category,crowd_size,environments,intensity,duration_seconds,loopable,gain_db,fade_in_ms,fade_out_ms,cue_start_seconds,cue_end_seconds,enabled,rights_confirmed,source_notes")
      .eq("enabled", true).eq("rights_confirmed", true).order("id");
    if (error) throw error;
    cache = (data ?? []).map((row) => readAsset(row)).filter((row): row is CuratedCrowdAsset => !!row);
    return cache;
  })().finally(() => { pending = null; });
  return pending;
}
export function invalidateCuratedCrowdAudioCache(): void { cache = null; pending = null; }

export function curatedAssetAsClip(asset: CuratedCrowdAsset): CrowdPlaybackClip {
  const { data } = supabase.storage.from("crowd-sounds").getPublicUrl(asset.storage_path);
  return {
    id: asset.id, url: data.publicUrl, loopable: asset.loopable,
    gainDb: asset.gain_db, fadeInMs: asset.fade_in_ms, fadeOutMs: asset.fade_out_ms,
    cueStartSeconds: asset.cue_start_seconds, cueEndSeconds: asset.cue_end_seconds,
    durationSeconds: asset.duration_seconds,
  };
}
export function selectCuratedCrowdClip(
  assets: readonly CuratedCrowdAsset[], request: CrowdCueRequest,
): CrowdPlaybackClip | null {
  const asset = selectCrowdCue(assets, request);
  return asset ? curatedAssetAsClip(asset as CuratedCrowdAsset) : null;
}
