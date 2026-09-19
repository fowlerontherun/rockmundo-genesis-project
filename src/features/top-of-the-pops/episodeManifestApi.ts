import { supabase } from "@/integrations/supabase/client";
import { getTotpPerformanceAudio, type TotpEpisode } from "./api";
import {
  buildTotpEpisodeManifest,
  validateTotpEpisodeManifest,
  type TotpEpisodeManifest,
  type TotpManifestIssue,
  type TotpProductionState,
  type TotpTrackRights,
} from "./episodeManifest";
import { totpRpc } from "./rpc";
import { TOTP_MEDIA_BUCKET, TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";

export interface StoredTotpEpisodeManifest {
  episode_id: string;
  manifest_version: number;
  production_state: TotpProductionState;
  checksum: string;
  total_runtime_ms: number;
  segment_count: number;
  manifest: TotpEpisodeManifest;
  issues: TotpManifestIssue[];
  created_at: string;
  updated_at: string;
}

/**
 * Every Top of the Pops performance is an in-game recording owned by the game
 * world, so the master rights are cleared by construction. Keeping this in one
 * place means a future licensing table only has to replace this function.
 */
export function inGameTrackRights(): TotpTrackRights {
  return {
    owner: "Rockmundo in-game master",
    licence: "rockmundo-broadcast",
    territories: ["WORLD"],
    expires_on: null,
    content_id_allowlisted: true,
    youtube_live_permitted: true,
    status: "cleared",
  };
}

export async function buildTotpEpisodeManifestFromEpisode(
  episode: TotpEpisode,
  options: { excludePerformanceIds?: string[] } = {},
): Promise<{ manifest: TotpEpisodeManifest; issues: TotpManifestIssue[] }> {
  const songAudio: Record<string, { url: string | null; duration_ms: number | null }> = {};
  const presenterAudio: Record<string, { url: string | null; duration_ms: number | null }> = {};
  const rights: Record<string, TotpTrackRights> = {};
  const presenterPath = TOTP_MEDIA_PATHS.presenter(episode.presenter_key, "act-intro");
  const presenterDirectory = presenterPath.slice(0, presenterPath.lastIndexOf("/"));
  const presenterFileName = presenterPath.slice(presenterPath.lastIndexOf("/") + 1);
  const presenterListing = await supabase.storage.from(TOTP_MEDIA_BUCKET).list(presenterDirectory, { limit: 100, search: presenterFileName });
  const presenterActIntro = !presenterListing.error && (presenterListing.data ?? []).some((item) => item.name === presenterFileName)
    ? totpMediaPublicUrl(presenterPath)
    : null;

  /**
   * Phase 5: an act removed by a takedown is dropped from the broadcast only.
   * The game's performances, fame and settlement rows are never touched.
   */
  const excluded = new Set(options.excludePerformanceIds ?? []);
  const performances = episode.performances.filter((performance) => !excluded.has(performance.performance_id));
  const broadcastEpisode = excluded.size > 0 ? { ...episode, performances } : episode;

  for (const performance of performances) {
    const audio = await getTotpPerformanceAudio(performance.performance_id);
    const seconds = audio?.duration_seconds ?? null;
    songAudio[performance.performance_id] = {
      url: audio?.audio_url ?? null,
      duration_ms: seconds && seconds > 0 ? Math.round(seconds * 1000) : null,
    };
    presenterAudio[performance.performance_id] = {
      url: presenterActIntro,
      duration_ms: 8_000,
    };
    rights[performance.song_id] = inGameTrackRights();
  }

  const manifest = buildTotpEpisodeManifest({ episode: broadcastEpisode, songAudio, presenterAudio, rights });
  return { manifest, issues: validateTotpEpisodeManifest(manifest) };
}

export async function getStoredTotpEpisodeManifest(
  episodeId?: string | null,
): Promise<StoredTotpEpisodeManifest | null> {
  const { data, error } = await totpRpc<StoredTotpEpisodeManifest>("totp_episode_manifest", {
    p_episode_id: episodeId ?? null,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops running sheet.");
  return data ?? null;
}

export async function saveTotpEpisodeManifest(params: {
  episodeId: string;
  manifest: TotpEpisodeManifest;
  issues?: TotpManifestIssue[];
  productionState?: TotpProductionState;
}): Promise<StoredTotpEpisodeManifest> {
  const { data, error } = await totpRpc<StoredTotpEpisodeManifest>("totp_admin_save_episode_manifest", {
    p_episode_id: params.episodeId,
    p_manifest: params.manifest,
    p_issues: params.issues ?? [],
    p_production_state: params.productionState ?? "gameplay",
  });
  if (error) throw new Error(error.message || "Could not save the Top of the Pops running sheet.");
  if (!data) throw new Error("Top of the Pops returned no stored running sheet.");
  return data;
}

export function storedManifestMatchesLive(
  stored: StoredTotpEpisodeManifest | null,
  live: TotpEpisodeManifest | null,
): boolean {
  if (!stored || !live) return false;
  return stored.checksum === live.checksum;
}
