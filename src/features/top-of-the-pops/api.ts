import type { TotpBroadcastCue } from "./broadcastTimeline";
import { totpRpc } from "./rpc";

export type TotpInvitationStatus =
  | "invited"
  | "accepted"
  | "declined"
  | "expired"
  | "checked_in"
  | "performed"
  | "missed";

export type TotpInvitationResponseOutcome = "accepted" | "declined" | "expired";

export interface TotpInvitation {
  invitation_id: string;
  episode_id: string;
  episode_date: string;
  check_in_at: string;
  broadcast_at: string;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  qualifying_rank: number;
  status: TotpInvitationStatus;
  response_deadline: string;
  london_city_id: string;
  london_city_name: string;
}

export interface TotpPerformance {
  performance_id: string;
  running_order: number;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  stage_key: "main_stage" | "stage_b" | "rock_stage" | "studio_floor" | string;
  presenter_intro: string | null;
  qualifying_rank: number;
}

export interface TotpEpisode {
  id: string;
  episode_number: number;
  episode_date: string;
  status: string;
  check_in_at: string;
  broadcast_at: string;
  presenter_key: string;
  presenter_display_name?: string | null;
  show_variant?: string | null;
  broadcast_profile: string;
  performances: TotpPerformance[];
}

export interface TotpArchivedVisualSnapshot {
  appearance?: unknown;
  legacyAvatar?: unknown;
  richClothing?: Array<{
    item?: unknown;
    selectedVariantKey?: string | null;
    customizationConfig?: unknown;
  }>;
}

export interface TotpArchivedBandMember {
  profile_id: string | null;
  display_name: string;
  role: string;
  instrument_role?: string | null;
  vocal_role?: string | null;
  visual_snapshot?: TotpArchivedVisualSnapshot | null;
}

export interface TotpBroadcastReplayPayload {
  schemaVersion: number;
  episodeId: string;
  episodeNumber: number;
  episodeDate: string;
  broadcastAt: string;
  performanceId: string;
  runningOrder: number;
  presenterKey: string;
  presenterDisplayName?: string | null;
  showVariant?: string | null;
  liveTv?: {
    audienceReaction?: number | null;
  } | null;
  band: {
    id: string;
    name: string;
    members: TotpArchivedBandMember[];
  };
  song: {
    id: string;
    title: string;
    genre: string;
    qualifyingRank: number;
    audioUrl?: string | null;
    audioGenerationStatus?: string | null;
    audioDurationSeconds?: number | null;
  };
  stage: "main_stage" | "stage_b" | "rock_stage" | "studio_floor";
  performanceDurationMs: number;
  totalDurationMs: number;
  cues: TotpBroadcastCue[];
}

export interface TotpBroadcastReplay {
  id: string;
  performance_id: string;
  replay_version: number;
  stage_key: string;
  presenter_key: string;
  duration_ms: number;
  checksum: string;
  generated_at: string;
  payload: TotpBroadcastReplayPayload;
}

export interface TotpBroadcastArchive {
  episode_id: string | null;
  replays: TotpBroadcastReplay[];
}

export interface TotpPerformanceAudio {
  audio_url: string | null;
  audio_generation_status: string | null;
  duration_seconds: number | null;
}

export interface TotpPresenterPlaybackAsset {
  cue_id?: string;
  kind?: string;
  performance_id?: string | null;
  presenter_key: string;
  script_text: string;
  script_checksum: string;
  audio_url: string;
  duration_ms: number;
  sha256: string;
  version: number;
  uploaded_at: string;
}

export interface TotpCheckInResult {
  status: "checked_in";
  already_checked_in?: boolean;
  members_required?: number;
  members_present?: number;
  checked_in_at?: string;
}

export interface TotpCompletionResult {
  status: "completed" | "already_completed";
  performance_id: string;
  history_id?: string;
  appearance_number: number;
  qualifying_rank: number;
  raw_fame_reward?: number;
  fame_awarded: number;
  lifetime_factor?: number;
  progression_factor?: number;
}

export interface TotpAppearanceHistoryRow {
  episode_date: string;
  episode_number: number;
  performance_id: string;
  band_id: string;
  band_name: string;
  song_id: string;
  song_title: string;
  qualifying_rank: number;
  running_order: number;
  stage_key: string;
  appearance_number: number;
  fame_awarded: number;
  presenter_intro: string | null;
  completed_at: string;
}

export interface TotpBandStats {
  band_id: string;
  appearances: number;
  best_chart_rank: number | null;
  number_one_appearances: number;
  top_10_appearances: number;
  total_fame_awarded: number;
  first_appearance: string | null;
  latest_appearance: string | null;
}

export type TotpInterviewChoice = "confident" | "humble" | "cheeky";

export interface TotpBackstageInteraction {
  id: string;
  invitation_id: string;
  episode_id: string;
  band_id: string;
  band_name: string;
  prompt_key: "first_impressions" | "chart_pressure" | "fans_waiting" | "live_television" | string;
  selected_choice: TotpInterviewChoice | null;
  effects: {
    reputation?: number;
    fan_sentiment?: number;
    media_intensity?: number;
    chart_effect?: number;
    cash_effect?: number;
  };
  created_at: string;
  resolved_at: string | null;
}

export interface TotpBackstageChoiceResult {
  status: "resolved" | "already_resolved";
  choice: TotpInterviewChoice;
  effects: TotpBackstageInteraction["effects"];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invitationId(value: string): string {
  const normalized = value?.trim();
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new Error("Choose a valid Top of the Pops invitation.");
  }
  return normalized;
}

export async function listMyTotpInvitations(): Promise<TotpInvitation[]> {
  const { data, error } = await totpRpc<TotpInvitation[]>("totp_my_invitations");
  if (error) throw new Error(error.message || "Could not load Top of the Pops invitations.");
  return data ?? [];
}

export async function respondToTotpInvitation(id: string, response: "accepted" | "declined"): Promise<TotpInvitationResponseOutcome> {
  const normalizedId = invitationId(id);
  const { data, error } = await totpRpc<TotpInvitationResponseOutcome>("totp_respond_to_invitation", {
    p_invitation_id: normalizedId,
    p_response: response,
  });
  if (error) throw new Error(error.message || "Could not update the Top of the Pops invitation.");
  const outcome = data ?? response;
  if (outcome === "accepted" || outcome === "declined" || outcome === "expired") return outcome;
  throw new Error("Top of the Pops returned an unexpected invitation response.");
}

export async function checkInToTotp(id: string): Promise<TotpCheckInResult> {
  const normalizedId = invitationId(id);
  const { data, error } = await totpRpc<TotpCheckInResult>("totp_check_in", {
    p_invitation_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Top of the Pops studio check-in failed.");
  return data ?? { status: "checked_in" };
}

export async function getTotpEpisode(id?: string | null): Promise<TotpEpisode | null> {
  const normalized = id ? invitationId(id) : null;
  const { data, error } = await totpRpc<TotpEpisode>("totp_public_episode", {
    p_episode_id: normalized,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops episode.");
  return data;
}

export async function getTotpEpisodePresenterAudio(
  episodeId: string,
): Promise<Record<string, TotpPresenterPlaybackAsset>> {
  const { data, error } = await totpRpc<Record<string, TotpPresenterPlaybackAsset>>(
    "totp_episode_presenter_audio",
    { p_episode_id: invitationId(episodeId) },
  );
  if (error) throw new Error(error.message || "Could not load presenter recordings.");
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

export async function getTotpBroadcastArchive(episodeId?: string | null): Promise<TotpBroadcastArchive> {
  const normalized = episodeId ? invitationId(episodeId) : null;
  const { data, error } = await totpRpc<TotpBroadcastArchive>("totp_public_broadcast_archive", {
    p_episode_id: normalized,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops broadcast archive.");
  return data ?? { episode_id: normalized, replays: [] };
}

export async function getTotpPerformanceAudio(performanceId: string): Promise<TotpPerformanceAudio | null> {
  const normalizedId = invitationId(performanceId);
  const { data, error } = await totpRpc<TotpPerformanceAudio>("totp_public_performance_audio", {
    p_performance_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Could not load Top of the Pops performance audio.");
  return data ?? null;
}

export async function getTotpPublicHistory(bandId?: string | null, limit = 50): Promise<TotpAppearanceHistoryRow[]> {
  const normalizedBandId = bandId ? invitationId(bandId) : null;
  const { data, error } = await totpRpc<TotpAppearanceHistoryRow[]>("totp_public_history", {
    p_band_id: normalizedBandId,
    p_limit: Math.max(1, Math.min(200, Math.round(limit))),
  });
  if (error) throw new Error(error.message || "Could not load Top of the Pops appearance history.");
  return data ?? [];
}

export async function getTotpBandStats(bandId: string): Promise<TotpBandStats> {
  const normalizedBandId = invitationId(bandId);
  const { data, error } = await totpRpc<TotpBandStats>("totp_band_stats", {
    p_band_id: normalizedBandId,
  });
  if (error) throw new Error(error.message || "Could not load Top of the Pops statistics.");
  return data ?? {
    band_id: normalizedBandId,
    appearances: 0,
    best_chart_rank: null,
    number_one_appearances: 0,
    top_10_appearances: 0,
    total_fame_awarded: 0,
    first_appearance: null,
    latest_appearance: null,
  };
}

export async function listMyTotpBackstageInteractions(): Promise<TotpBackstageInteraction[]> {
  const { data, error } = await totpRpc<TotpBackstageInteraction[]>("totp_my_backstage_interactions");
  if (error) throw new Error(error.message || "Could not load the Top of the Pops backstage interview.");
  return data ?? [];
}

export async function chooseTotpBackstageInterview(id: string, choice: TotpInterviewChoice): Promise<TotpBackstageChoiceResult> {
  const normalizedId = invitationId(id);
  const { data, error } = await totpRpc<TotpBackstageChoiceResult>("totp_choose_backstage_interview", {
    p_interaction_id: normalizedId,
    p_choice: choice,
  });
  if (error) throw new Error(error.message || "Could not save the Top of the Pops interview response.");
  if (!data) throw new Error("Top of the Pops returned no interview response.");
  return data;
}

export async function adminLockTotpRunningOrder(episodeId: string): Promise<number> {
  const normalizedId = invitationId(episodeId);
  const { data, error } = await totpRpc<number>("totp_admin_lock_running_order", {
    p_episode_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Could not lock the Top of the Pops running order.");
  return Number(data ?? 0);
}

export async function adminBuildTotpBroadcastArchive(episodeId: string): Promise<number> {
  const normalizedId = invitationId(episodeId);
  const { data, error } = await totpRpc<number>("totp_build_episode_broadcast_replays", {
    p_episode_id: normalizedId,
  });
  if (error) throw new Error(error.message || "Could not build the Top of the Pops broadcast archive.");
  return Number(data ?? 0);
}

export async function adminCompleteTotpPerformance(performanceId: string, performanceScore?: number | null): Promise<TotpCompletionResult> {
  const normalizedId = invitationId(performanceId);
  const { data, error } = await totpRpc<TotpCompletionResult>("totp_complete_performance", {
    p_performance_id: normalizedId,
    p_performance_score: performanceScore == null ? null : Math.max(0, Math.min(100, Math.round(performanceScore))),
  });
  if (error) throw new Error(error.message || "Could not complete the Top of the Pops performance.");
  if (!data) throw new Error("Top of the Pops returned no performance settlement.");
  return data;
}

export function canRespondToTotpInvitation(invitation: TotpInvitation, now = new Date()): boolean {
  return invitation.status === "invited" && now.getTime() <= new Date(invitation.response_deadline).getTime();
}

export function canAttemptTotpCheckIn(invitation: TotpInvitation, now = new Date()): boolean {
  if (invitation.status !== "accepted") return false;
  const checkIn = new Date(invitation.check_in_at).getTime();
  const current = now.getTime();
  return current >= checkIn - 2 * 60 * 60 * 1000 && current <= checkIn + 45 * 60 * 1000;
}
