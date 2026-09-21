import { getTotpEpisodePresenterFragments, getTotpPerformanceAudio, type TotpEpisode, type TotpPresenterFragmentBundle } from "./api";
import {
  buildTotpEpisodeManifest,
  canonicalise,
  manifestChecksum,
  validateTotpEpisodeManifest,
  type TotpEpisodeManifest,
  type TotpManifestIssue,
  type TotpProductionState,
  type TotpTrackRights,
} from "./episodeManifest";
import { totpRpc } from "./rpc";
import { getTotpEpisodePlan } from "./scheduleApi";
import { buildTotpPresenterDialogue } from "./presenterDialogue";
import { matchTotpReusablePresenterPhrase } from "./presenterPhraseAudio";
import { totpRemoteAudioDurationMs, totpRemoteAudioSha256 } from "./audioAsset";
import { totpMediaPublicUrl } from "./totpMedia";

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

const TOTP_REUSABLE_PRESENTER_GAP_MS = 65;

function emptyPresenterFragments(): TotpPresenterFragmentBundle {
  return { presenter_key: null, phrases: {}, bands: {} };
}

function reusablePhraseSha256(storagePath: string): string | null {
  const match = /-([a-f0-9]{64})\.(?:mp3|wav|ogg|webm|m4a|mp4)$/i.exec(storagePath);
  return match?.[1]?.toLowerCase() ?? null;
}

function exactPresenterAssetMatchesScript(
  asset: { audio_url?: string | null; duration_ms?: number | null; sha256?: string | null; version?: number | null; script_checksum?: string | null } | null | undefined,
  script: string | null | undefined,
): boolean {
  if (!asset || !script?.trim()) return false;
  return Boolean(
    asset.audio_url
      && asset.duration_ms
      && asset.duration_ms > 0
      && asset.sha256
      && asset.version
      && asset.script_checksum === manifestChecksum(canonicalise(script)),
  );
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
  const presenterSequences: NonNullable<Parameters<typeof buildTotpEpisodeManifest>[0]["presenterSequences"]> = {};
  const rights: Record<string, TotpTrackRights> = {};
  const [plan, presenterFragments] = await Promise.all([
    getTotpEpisodePlan(episode.id),
    getTotpEpisodePresenterFragments(episode.id).catch(() => emptyPresenterFragments()),
  ]);
  const reusableDurationByPath = new Map<string, number>();

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
    if (exactPresenterAssetMatchesScript(plannedPresenter, performance.presenter_intro)) {
      presenterAudio[performance.performance_id] = {
        url: plannedPresenter!.audio_url,
        duration_ms: plannedPresenter!.duration_ms,
        sha256: plannedPresenter!.sha256,
        version: plannedPresenter!.version,
        script_checksum: plannedPresenter!.script_checksum,
      };
      continue;
    }

    const script = performance.presenter_intro?.trim() ?? "";
    const phrase = script ? matchTotpReusablePresenterPhrase(script, performance.band_name) : null;
    const phraseAsset = phrase ? presenterFragments.phrases?.[phrase.id] : null;
    const bandAsset = presenterFragments.bands?.[performance.band_id] ?? null;
    if (
      !phrase
      || !phraseAsset?.storage_path
      || !bandAsset?.audio_url
      || !bandAsset.sha256
      || !bandAsset.duration_ms
      || bandAsset.duration_ms <= 0
      || bandAsset.band_name !== performance.band_name
    ) {
      continue;
    }

    const phraseUrl = totpMediaPublicUrl(phraseAsset.storage_path);
    let phraseDurationMs = reusableDurationByPath.get(phraseAsset.storage_path) ?? null;
    let phraseSha256 = reusablePhraseSha256(phraseAsset.storage_path);
    try {
      if (!phraseDurationMs) {
        phraseDurationMs = await totpRemoteAudioDurationMs(phraseUrl);
        reusableDurationByPath.set(phraseAsset.storage_path, phraseDurationMs);
      }
      if (!phraseSha256) {
        phraseSha256 = await totpRemoteAudioSha256(phraseUrl);
      }
    } catch {
      continue;
    }
    if (!phraseSha256) continue;

    presenterSequences[performance.performance_id] = {
      duration_ms: phraseDurationMs + TOTP_REUSABLE_PRESENTER_GAP_MS + bandAsset.duration_ms,
      script_checksum: manifestChecksum(canonicalise(script)),
      gap_ms: TOTP_REUSABLE_PRESENTER_GAP_MS,
      fragments: [
        {
          role: "phrase",
          url: phraseUrl,
          duration_ms: phraseDurationMs,
          sha256: phraseSha256,
          version: null,
        },
        {
          role: "band_name",
          url: bandAsset.audio_url,
          duration_ms: bandAsset.duration_ms,
          sha256: bandAsset.sha256,
          version: bandAsset.version,
        },
      ],
    };
  }

  const presenterDialogue = buildTotpPresenterDialogue(broadcastEpisode).map((line) => {
    const planned = plan?.presenter_audio?.[line.planKey];
    const current = exactPresenterAssetMatchesScript(planned, line.script);
    return {
      cue_id: line.id,
      kind: line.kind,
      performance_id: line.performanceId,
      script_text: line.script,
      audio: current
        ? {
            url: planned!.audio_url,
            duration_ms: planned!.duration_ms,
            sha256: planned!.sha256,
            version: planned!.version,
            script_checksum: planned!.script_checksum,
          }
        : null,
    };
  });

  const manifest = buildTotpEpisodeManifest({
    episode: broadcastEpisode,
    songAudio,
    presenterAudio,
    presenterSequences,
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
