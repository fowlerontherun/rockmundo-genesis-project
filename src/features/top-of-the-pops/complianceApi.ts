import { totpRpc } from "./rpc";
import type { TotpStageKey } from "./broadcastProfile";
import type { TotpBroadcastCue } from "./broadcastTimeline";
import { buildTotpCaptionCues, type TotpCaptionCue } from "./broadcastCaptions";
import type { TotpEpisodeManifest } from "./episodeManifest";
import type {
  TotpComplianceReport,
  TotpEpisodeConsent,
  TotpEpisodeTakedown,
} from "./complianceScreening";

export interface TotpBroadcastConsent {
  granted: boolean;
  consent_version: number;
  scopes: string[];
  granted_at: string | null;
  withdrawn_at: string | null;
}

export interface StoredTotpComplianceReport {
  episode_id: string;
  manifest_checksum: string | null;
  passed: boolean;
  blocker_count: number;
  warning_count: number;
  report: TotpComplianceReport | Record<string, unknown>;
  screened_by: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SCOPES = ["band_name", "avatar", "recording", "lyrics"];

function normaliseConsent(row: unknown): TotpBroadcastConsent {
  const entry = (row ?? {}) as Partial<TotpBroadcastConsent>;
  return {
    granted: Boolean(entry.granted),
    consent_version: Number(entry.consent_version ?? 1),
    scopes: Array.isArray(entry.scopes) && entry.scopes.length > 0 ? entry.scopes.map(String) : DEFAULT_SCOPES,
    granted_at: entry.granted_at ?? null,
    withdrawn_at: entry.withdrawn_at ?? null,
  };
}

export async function getMyTotpBroadcastConsent(): Promise<TotpBroadcastConsent> {
  const { data, error } = await totpRpc<unknown>("totp_my_broadcast_consent");
  if (error) throw new Error(error.message || "Could not load your broadcast permission.");
  return normaliseConsent(data);
}

export async function setMyTotpBroadcastConsent(granted: boolean, scopes?: string[]): Promise<TotpBroadcastConsent> {
  const { data, error } = await totpRpc<unknown>("totp_set_broadcast_consent", {
    p_granted: granted,
    p_scopes: scopes ?? DEFAULT_SCOPES,
  });
  if (error) throw new Error(error.message || "Could not save your broadcast permission.");
  return normaliseConsent(data);
}

export async function getTotpEpisodeConsents(episodeId: string): Promise<TotpEpisodeConsent[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_admin_episode_consents", { p_episode_id: episodeId });
  if (error) throw new Error(error.message || "Could not load player permissions for this episode.");
  return (Array.isArray(data) ? data : []).map((row) => {
    const entry = (row ?? {}) as Record<string, unknown>;
    return {
      performance_id: String(entry.performance_id ?? ""),
      band_id: String(entry.band_id ?? ""),
      band_name: String(entry.band_name ?? "Unknown act"),
      player_members: Number(entry.player_members ?? 0),
      consented_members: Number(entry.consented_members ?? 0),
      consented: Boolean(entry.consented),
    };
  });
}

export async function getTotpEpisodeTakedowns(episodeId: string, activeOnly = false): Promise<TotpEpisodeTakedown[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_episode_takedowns", {
    p_episode_id: episodeId,
    p_active_only: activeOnly,
  });
  if (error) throw new Error(error.message || "Could not load takedown requests.");
  return (Array.isArray(data) ? data : []).map((row) => {
    const entry = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(entry.id ?? ""),
      episode_id: String(entry.episode_id ?? ""),
      performance_id: (entry.performance_id as string | null) ?? null,
      action: (entry.action as TotpEpisodeTakedown["action"]) ?? "remove",
      reason: String(entry.reason ?? ""),
      replacement_note: (entry.replacement_note as string | null) ?? null,
      active: Boolean(entry.active),
      created_at: String(entry.created_at ?? ""),
    };
  });
}

export async function recordTotpTakedown(params: {
  episodeId: string;
  performanceId?: string | null;
  action: TotpEpisodeTakedown["action"];
  reason: string;
  replacementNote?: string | null;
}): Promise<TotpEpisodeTakedown> {
  const { error } = await totpRpc<unknown>("totp_admin_record_takedown", {
    p_episode_id: params.episodeId,
    p_performance_id: params.performanceId ?? null,
    p_action: params.action,
    p_reason: params.reason,
    p_replacement_note: params.replacementNote ?? null,
  });
  if (error) throw new Error(error.message || "Could not record the takedown request.");
  const list = await getTotpEpisodeTakedowns(params.episodeId, true);
  return list[0];
}

export async function clearTotpTakedown(takedownId: string): Promise<void> {
  const { error } = await totpRpc<unknown>("totp_admin_clear_takedown", { p_takedown_id: takedownId });
  if (error) throw new Error(error.message || "Could not close the takedown request.");
}

export async function getTotpComplianceReport(episodeId: string): Promise<StoredTotpComplianceReport | null> {
  const { data, error } = await totpRpc<StoredTotpComplianceReport>("totp_episode_compliance_report", {
    p_episode_id: episodeId,
  });
  if (error) throw new Error(error.message || "Could not load the episode screening report.");
  return data ?? null;
}

export async function saveTotpComplianceReport(report: TotpComplianceReport): Promise<StoredTotpComplianceReport> {
  const { data, error } = await totpRpc<StoredTotpComplianceReport>("totp_admin_save_compliance_report", {
    p_episode_id: report.episode_id,
    p_report: report as unknown as Record<string, unknown>,
    p_passed: report.passed,
    p_blocker_count: report.blockers.length,
    p_warning_count: report.warnings.length,
    p_manifest_checksum: report.manifest_checksum,
  });
  if (error) throw new Error(error.message || "Could not save the episode screening report.");
  if (!data) throw new Error("Top of the Pops returned no screening report.");
  return data;
}

/**
 * Captions used for screening. Built straight from the running sheet so the
 * accessibility check never depends on a browser playing the programme.
 */
export function captionsFromTotpManifest(manifest: TotpEpisodeManifest, presenterName: string): TotpCaptionCue[] {
  const cues: TotpBroadcastCue[] = [];
  let offsetMs = 0;

  manifest.segments.forEach((segment, index) => {
    const stage = segment.stage_key as TotpStageKey;
    const songMs = segment.assets.find((asset) => asset.kind === "song_audio")?.duration_ms ?? 180_000;

    if (segment.presenter_intro) {
      cues.push({
        id: `screen-presenter-${index}`,
        type: "presenter",
        offsetMs,
        durationMs: 4_200,
        cameraShot: "presenter_wide",
        stage,
        presenterText: segment.presenter_intro,
      });
    }
    offsetMs += 4_200;

    cues.push({
      id: `screen-graphic-${index}`,
      type: "graphic",
      offsetMs: offsetMs + 650,
      durationMs: 3_200,
      cameraShot: "crane_sweep",
      stage,
      graphic: {
        artistName: segment.band_name,
        songTitle: segment.song_title,
        chartRank: segment.qualifying_rank,
      },
    });

    offsetMs += Math.max(30_000, songMs);
    cues.push({
      id: `screen-audience-${index}`,
      type: "audience",
      offsetMs,
      durationMs: 4_000,
      cameraShot: "audience_dance",
      stage,
    });
    offsetMs += 4_000;
  });

  return buildTotpCaptionCues(cues, { presenterName });
}
