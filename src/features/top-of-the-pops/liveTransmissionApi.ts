import { totpRpc } from "./rpc";
import type {
  TotpLiveHealthSample,
  TotpLiveMode,
  TotpLiveSource,
  TotpLiveState,
} from "./liveTransmission";

export interface TotpLiveSession {
  id: string;
  episode_id: string;
  mode: TotpLiveMode;
  state: TotpLiveState;
  primary_source_label: string;
  backup_source_label: string;
  active_source: TotpLiveSource;
  youtube_broadcast_id: string | null;
  stream_key_label: string | null;
  manifest_checksum: string | null;
  standby_at: string | null;
  test_started_at: string | null;
  live_at: string | null;
  ended_at: string | null;
  failover_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TotpLiveEvent {
  id: string;
  session_id: string;
  kind: string;
  headline: string;
  detail: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

function normaliseSession(row: unknown): TotpLiveSession {
  const entry = (row ?? {}) as Partial<TotpLiveSession>;
  return {
    id: String(entry.id ?? ""),
    episode_id: String(entry.episode_id ?? ""),
    mode: (entry.mode ?? "soak") as TotpLiveMode,
    state: (entry.state ?? "offline") as TotpLiveState,
    primary_source_label: entry.primary_source_label ?? "Main encoder",
    backup_source_label: entry.backup_source_label ?? "Backup encoder",
    active_source: (entry.active_source ?? "primary") as TotpLiveSource,
    youtube_broadcast_id: entry.youtube_broadcast_id ?? null,
    stream_key_label: entry.stream_key_label ?? null,
    manifest_checksum: entry.manifest_checksum ?? null,
    standby_at: entry.standby_at ?? null,
    test_started_at: entry.test_started_at ?? null,
    live_at: entry.live_at ?? null,
    ended_at: entry.ended_at ?? null,
    failover_count: Number(entry.failover_count ?? 0),
    notes: entry.notes ?? null,
    created_at: String(entry.created_at ?? ""),
    updated_at: String(entry.updated_at ?? ""),
  };
}

function normaliseSample(row: unknown): TotpLiveHealthSample {
  const entry = (row ?? {}) as Record<string, unknown>;
  const num = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    sampled_at: String(entry.sampled_at ?? ""),
    source: (entry.source === "backup" ? "backup" : "primary") as TotpLiveSource,
    bitrate_kbps: num(entry.bitrate_kbps),
    dropped_frame_ratio: num(entry.dropped_frame_ratio),
    audio_peak_dbfs: num(entry.audio_peak_dbfs),
    delay_ms: num(entry.delay_ms),
    stream_status: (entry.stream_status as string | null) ?? null,
  };
}

function normaliseEvent(row: unknown): TotpLiveEvent {
  const entry = (row ?? {}) as Partial<TotpLiveEvent>;
  return {
    id: String(entry.id ?? ""),
    session_id: String(entry.session_id ?? ""),
    kind: String(entry.kind ?? "note"),
    headline: String(entry.headline ?? ""),
    detail: (entry.detail ?? {}) as Record<string, unknown>,
    actor_id: entry.actor_id ?? null,
    created_at: String(entry.created_at ?? ""),
  };
}

export async function getTotpEpisodeLiveSessions(episodeId: string): Promise<TotpLiveSession[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_episode_live_sessions", { p_episode_id: episodeId });
  if (error) throw new Error(error.message || "Could not load the transmissions for this episode.");
  return (Array.isArray(data) ? data : []).map(normaliseSession);
}

export async function getTotpRecentLiveSessions(limit = 40): Promise<TotpLiveSession[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_live_recent_sessions", { p_limit: limit });
  if (error) throw new Error(error.message || "Could not load the transmission history.");
  return (Array.isArray(data) ? data : []).map(normaliseSession);
}

export async function getTotpLiveHealth(sessionId: string, limit = 60): Promise<TotpLiveHealthSample[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_live_session_health", {
    p_session_id: sessionId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Could not load the transmission readings.");
  return (Array.isArray(data) ? data : []).map(normaliseSample);
}

export async function getTotpLiveEvents(sessionId: string, limit = 50): Promise<TotpLiveEvent[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_live_session_events", {
    p_session_id: sessionId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Could not load the transmission log.");
  return (Array.isArray(data) ? data : []).map(normaliseEvent);
}

export async function startTotpLiveSession(params: {
  episodeId: string;
  mode: TotpLiveMode;
  manifestChecksum?: string | null;
  youtubeBroadcastId?: string | null;
  streamKeyLabel?: string | null;
}): Promise<TotpLiveSession> {
  const { data, error } = await totpRpc<unknown>("totp_admin_start_live_session", {
    p_episode_id: params.episodeId,
    p_mode: params.mode,
    p_manifest_checksum: params.manifestChecksum ?? null,
    p_youtube_broadcast_id: params.youtubeBroadcastId ?? null,
    p_stream_key_label: params.streamKeyLabel ?? null,
  });
  if (error) throw new Error(error.message || "Could not put the transmission on standby.");
  return normaliseSession(Array.isArray(data) ? data[0] : data);
}

export async function transitionTotpLiveSession(
  sessionId: string,
  state: TotpLiveState,
  note?: string | null,
): Promise<TotpLiveSession> {
  const { data, error } = await totpRpc<unknown>("totp_admin_transition_live_session", {
    p_session_id: sessionId,
    p_state: state,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message || "Could not change the transmission state.");
  return normaliseSession(Array.isArray(data) ? data[0] : data);
}

export async function switchTotpLiveSource(
  sessionId: string,
  source: TotpLiveSource,
  reason?: string | null,
): Promise<TotpLiveSession> {
  const { data, error } = await totpRpc<unknown>("totp_admin_switch_live_source", {
    p_session_id: sessionId,
    p_source: source,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message || "Could not switch the transmission source.");
  return normaliseSession(Array.isArray(data) ? data[0] : data);
}

export async function recordTotpLiveHealth(params: {
  sessionId: string;
  source: TotpLiveSource;
  bitrateKbps?: number | null;
  droppedFrameRatio?: number | null;
  audioPeakDbfs?: number | null;
  delayMs?: number | null;
  streamStatus?: string | null;
}): Promise<TotpLiveHealthSample> {
  const { data, error } = await totpRpc<unknown>("totp_admin_record_live_health", {
    p_session_id: params.sessionId,
    p_source: params.source,
    p_bitrate_kbps: params.bitrateKbps ?? null,
    p_dropped_frame_ratio: params.droppedFrameRatio ?? null,
    p_audio_peak_dbfs: params.audioPeakDbfs ?? null,
    p_delay_ms: params.delayMs ?? null,
    p_stream_status: params.streamStatus ?? null,
  });
  if (error) throw new Error(error.message || "Could not save the transmission reading.");
  return normaliseSample(Array.isArray(data) ? data[0] : data);
}
