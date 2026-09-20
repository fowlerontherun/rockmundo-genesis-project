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
import { getTotpEpisodePlan } from "./scheduleApi";
import { buildTotpPresenterDialogue } from "./presenterDialogue";

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

/** Missing rights are deliberately pending: external clearance must be explicit. */
export function unverifiedTrackRights(): TotpTrackRights {
  return {
    owner: "",
    licence: "",
    territories: [],
    expires_on: null,
    content_id_allowlisted: false,
    youtube_live_permitted: false,
    status: "pending",
  };
}

export async function buildTotpEpisodeManifestFromEpisode(
  episode: TotpEpisode,
  options: { excludePerformanceIds?: string[] } = {},
): Promise<{ manifest: TotpEpisodeManifest; issues: TotpManifestIssue[] }> {
  const songAudio: Record<string, { url: string | null; duration_ms: number | null }> = {};
  const presenterAudio: Record<string, {
    url: string | null;
    duration_ms: number | null;
    sha256: string | null;
    version: number | null;
    script_checksum: string | null;
  }> = {};
  const rights: Record<string, TotpTrackRights> = {};
  const plan = await getTotpEpisodePlan(episode.id);

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
    const plannedRights = plan?.broadcast_rights?.[performance.song_id];
    rights[performance.song_id] = plannedRights
      ? {
          owner: plannedRights.owner,
          licence: plannedRights.licence,
          territories: plannedRights.territories,
          expires_on: plannedRights.expires_on,
          content_id_allowlisted: plannedRights.content_id_allowlisted,
          youtube_live_permitted: plannedRights.youtube_live_permitted,
          status: plannedRights.status,
        }
      : unverifiedTrackRights();

    const plannedPresenter = plan?.presenter_audio?.[performance.performance_id];
    if (plannedPresenter) {
      presenterAudio[performance.performance_id] = {
        url: plannedPresenter.audio_url,
        duration_ms: plannedPresenter.duration_ms,
        sha256: plannedPresenter.sha256,
        version: plannedPresenter.version,
        script_checksum: plannedPresenter.script_checksum,
      };
    }
  }

  const presenterDialogue = buildTotpPresenterDialogue(broadcastEpisode).map((line) => {
    const planned = plan?.presenter_audio?.[line.planKey];
    return {
      cue_id: line.id,
      kind: line.kind,
      performance_id: line.performanceId,
      script_text: line.script,
      audio: planned
        ? {
            url: planned.audio_url,
            duration_ms: planned.duration_ms,
            sha256: planned.sha256,
            version: planned.version,
            script_checksum: planned.script_checksum,
          }
        : null,
    };
  });

  const manifest = buildTotpEpisodeManifest({
    episode: broadcastEpisode,
    songAudio,
    presenterAudio,
    presenterDialogue,
    rights,
  });
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
