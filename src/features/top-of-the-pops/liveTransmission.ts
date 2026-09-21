import type { TotpEpisodeManifest } from "./episodeManifest";
import { buildTotpRenderPlan } from "./renderSpec";

/**
 * Phase 6 — live transmission.
 *
 * The app never touches an RTMPS stream key: an external playout machine holds
 * the key and pushes the approved master. Everything here is the operator desk
 * around that: the session state machine, the on-air rundown, the health
 * thresholds we judge the feed by, the backup-source decision and the soak-test
 * gate that keeps public transmission switched off until rehearsals are solid.
 */

export type TotpLiveState =
  | "offline"
  | "standby"
  | "testing"
  | "live"
  | "holding"
  | "aborted"
  | "complete";

export type TotpLiveMode = "soak" | "public";
export type TotpLiveSource = "primary" | "backup";

export const TOTP_LIVE_STATE_LABELS: Record<TotpLiveState, string> = {
  offline: "Off air",
  standby: "On standby",
  testing: "Private test",
  live: "On air",
  holding: "Holding on slate",
  aborted: "Aborted",
  complete: "Finished",
};

export const TOTP_LIVE_SOURCE_LABELS: Record<TotpLiveSource, string> = {
  primary: "Main encoder",
  backup: "Backup encoder",
};

/** Allowed moves through the state machine. Anything else is refused. */
const TRANSITIONS: Record<TotpLiveState, TotpLiveState[]> = {
  offline: ["standby", "aborted"],
  standby: ["testing", "holding", "aborted"],
  testing: ["standby", "live", "holding", "aborted"],
  live: ["holding", "complete", "aborted"],
  holding: ["live", "standby", "complete", "aborted"],
  aborted: [],
  complete: [],
};

export function canTotpLiveTransition(from: TotpLiveState, to: TotpLiveState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function totpLiveTransitionRefusal(from: TotpLiveState, to: TotpLiveState): string | null {
  if (canTotpLiveTransition(from, to)) return null;
  if (from === "aborted" || from === "complete") {
    return `This transmission is already ${TOTP_LIVE_STATE_LABELS[from].toLowerCase()} — start a new one.`;
  }
  if (to === "live" && from === "offline") {
    return "Put the transmission on standby and run a private test before going on air.";
  }
  return `You cannot go from ${TOTP_LIVE_STATE_LABELS[from].toLowerCase()} to ${TOTP_LIVE_STATE_LABELS[to].toLowerCase()}.`;
}

// ---------------------------------------------------------------- health

export interface TotpLiveHealthSample {
  sampled_at: string;
  source: TotpLiveSource;
  bitrate_kbps: number | null;
  dropped_frame_ratio: number | null;
  audio_peak_dbfs: number | null;
  delay_ms: number | null;
  stream_status: string | null;
}

export const TOTP_LIVE_HEALTH_LIMITS = {
  /** 1080p30 at 8 Mbps: warn when the feed sags, fail when it collapses. */
  bitrateWarnKbps: 6_000,
  bitrateFailKbps: 4_000,
  droppedWarnRatio: 0.005,
  droppedFailRatio: 0.02,
  /** Broadcast peak ceiling, and the floor below which we are effectively silent. */
  audioPeakCeilingDbfs: -1,
  audioSilenceDbfs: -45,
  delayWarnMs: 15_000,
  delayFailMs: 30_000,
  staleSampleMs: 30_000,
} as const;

export type TotpLiveHealthGrade = "good" | "degraded" | "failing" | "unknown";

export interface TotpLiveHealthFinding {
  code: string;
  grade: Exclude<TotpLiveHealthGrade, "unknown">;
  detail: string;
}

export interface TotpLiveHealthReport {
  grade: TotpLiveHealthGrade;
  findings: TotpLiveHealthFinding[];
  sample: TotpLiveHealthSample | null;
  stale: boolean;
  /** True when the current source is unusable and the backup should take over. */
  shouldFailover: boolean;
}

function worst(a: TotpLiveHealthGrade, b: TotpLiveHealthGrade): TotpLiveHealthGrade {
  const order: TotpLiveHealthGrade[] = ["unknown", "good", "degraded", "failing"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export function gradeTotpLiveHealth(
  samples: TotpLiveHealthSample[],
  options: { now?: Date } = {},
): TotpLiveHealthReport {
  const sample = samples.length > 0 ? samples[0] : null;
  if (!sample) {
    return { grade: "unknown", findings: [], sample: null, stale: true, shouldFailover: false };
  }

  const now = options.now ?? new Date();
  const sampledAt = Date.parse(sample.sampled_at);
  const stale =
    !Number.isFinite(sampledAt) || now.getTime() - sampledAt > TOTP_LIVE_HEALTH_LIMITS.staleSampleMs;

  const findings: TotpLiveHealthFinding[] = [];
  const limits = TOTP_LIVE_HEALTH_LIMITS;

  if (stale) {
    findings.push({
      code: "sample_stale",
      grade: "failing",
      detail: "No fresh reading from the encoder in the last 30 seconds.",
    });
  }

  if (sample.bitrate_kbps !== null) {
    if (sample.bitrate_kbps < limits.bitrateFailKbps) {
      findings.push({
        code: "bitrate",
        grade: "failing",
        detail: `Picture data has dropped to ${Math.round(sample.bitrate_kbps)} kbps.`,
      });
    } else if (sample.bitrate_kbps < limits.bitrateWarnKbps) {
      findings.push({
        code: "bitrate",
        grade: "degraded",
        detail: `Picture data is low at ${Math.round(sample.bitrate_kbps)} kbps.`,
      });
    }
  }

  if (sample.dropped_frame_ratio !== null) {
    const percent = (sample.dropped_frame_ratio * 100).toFixed(2);
    if (sample.dropped_frame_ratio > limits.droppedFailRatio) {
      findings.push({ code: "dropped_frames", grade: "failing", detail: `${percent}% of frames are being dropped.` });
    } else if (sample.dropped_frame_ratio > limits.droppedWarnRatio) {
      findings.push({ code: "dropped_frames", grade: "degraded", detail: `${percent}% of frames are being dropped.` });
    }
  }

  if (sample.audio_peak_dbfs !== null) {
    if (sample.audio_peak_dbfs <= limits.audioSilenceDbfs) {
      findings.push({ code: "audio_silent", grade: "failing", detail: "The sound has gone — the feed is silent." });
    } else if (sample.audio_peak_dbfs > limits.audioPeakCeilingDbfs) {
      findings.push({
        code: "audio_hot",
        grade: "degraded",
        detail: `Sound is peaking at ${sample.audio_peak_dbfs.toFixed(1)} dB — above the broadcast ceiling.`,
      });
    }
  }

  if (sample.delay_ms !== null) {
    if (sample.delay_ms > limits.delayFailMs) {
      findings.push({
        code: "delay",
        grade: "failing",
        detail: `The feed is ${Math.round(sample.delay_ms / 1000)} seconds behind.`,
      });
    } else if (sample.delay_ms > limits.delayWarnMs) {
      findings.push({
        code: "delay",
        grade: "degraded",
        detail: `The feed is ${Math.round(sample.delay_ms / 1000)} seconds behind.`,
      });
    }
  }

  const status = (sample.stream_status ?? "").toLowerCase();
  if (status && !["active", "good", "ok"].includes(status)) {
    findings.push({
      code: "stream_status",
      grade: ["nodata", "no_data", "error", "revoked", "inactive"].includes(status) ? "failing" : "degraded",
      detail: `YouTube reports the stream as "${sample.stream_status}".`,
    });
  }

  const grade = findings.reduce<TotpLiveHealthGrade>((acc, finding) => worst(acc, finding.grade), "good");
  return {
    grade,
    findings,
    sample,
    stale,
    shouldFailover: findings.some((finding) => finding.grade === "failing"),
  };
}

/** Which source should be on air, given the health of each encoder. */
export function chooseTotpLiveSource(params: {
  active: TotpLiveSource;
  primary: TotpLiveHealthReport;
  backup: TotpLiveHealthReport;
}): { source: TotpLiveSource; reason: string | null } {
  const { active, primary, backup } = params;
  if (active === "primary" && primary.shouldFailover) {
    if (backup.grade === "good" || backup.grade === "degraded") {
      return { source: "backup", reason: "The main encoder is failing — switch to the backup." };
    }
    return { source: "primary", reason: "The main encoder is failing and the backup is not healthy — hold on slate." };
  }
  if (active === "backup" && backup.shouldFailover && !primary.shouldFailover && primary.grade === "good") {
    return { source: "primary", reason: "The backup is failing and the main encoder is healthy again." };
  }
  return { source: active, reason: null };
}

// ---------------------------------------------------------------- rundown

export interface TotpLiveRundownItem {
  key: string;
  label: string;
  durationMs: number;
  /** Something the operator can safely sit on if the programme is not ready. */
  loopable: boolean;
}

export const TOTP_LIVE_SLATE_MS = 60_000;
export const TOTP_LIVE_COUNTDOWN_MS = 30_000;
export const TOTP_LIVE_STANDBY_LOOP_MS = 120_000;
export const TOTP_LIVE_CLOSE_MS = 20_000;

/** Transmission order, including the standby material either side of the show. */
export function buildTotpLiveRundown(manifest: TotpEpisodeManifest | null): TotpLiveRundownItem[] {
  const programmeMs = manifest ? buildTotpRenderPlan(manifest).total_duration_ms : 0;
  return [
    { key: "slate", label: "Slate and ident", durationMs: TOTP_LIVE_SLATE_MS, loopable: true },
    { key: "countdown", label: "Countdown clock", durationMs: TOTP_LIVE_COUNTDOWN_MS, loopable: false },
    { key: "programme", label: "Episode master", durationMs: programmeMs, loopable: false },
    { key: "standby", label: "Standby loop (fallback)", durationMs: TOTP_LIVE_STANDBY_LOOP_MS, loopable: true },
    { key: "close", label: "Closing card", durationMs: TOTP_LIVE_CLOSE_MS, loopable: false },
  ];
}

export function totpLiveRundownTotalMs(items: TotpLiveRundownItem[]): number {
  return items
    .filter((item) => item.key !== "standby")
    .reduce((total, item) => total + item.durationMs, 0);
}

// ---------------------------------------------------------------- soak gate

export interface TotpLiveSessionSummary {
  id: string;
  mode: TotpLiveMode;
  state: TotpLiveState;
  failover_count: number;
  live_at: string | null;
  ended_at: string | null;
}

export const TOTP_LIVE_SOAK_TARGET = 5;

export interface TotpLiveReadiness {
  /** Private/unlisted rehearsals that ran all the way through to a clean finish. */
  soakCount: number;
  soakTarget: number;
  failoverRehearsed: boolean;
  publicPermitted: boolean;
  blockers: string[];
}

export function assessTotpLiveReadiness(sessions: TotpLiveSessionSummary[]): TotpLiveReadiness {
  const completedSoaks = sessions.filter(
    (session) => session.mode === "soak" && session.state === "complete" && !!session.live_at,
  );
  const soakCount = completedSoaks.length;
  const failoverRehearsed = completedSoaks.some((session) => session.failover_count > 0);

  const blockers: string[] = [];
  if (soakCount < TOTP_LIVE_SOAK_TARGET) {
    blockers.push(
      `${soakCount} of ${TOTP_LIVE_SOAK_TARGET} private rehearsals have run end to end without stopping.`,
    );
  }
  if (!failoverRehearsed) {
    blockers.push("No rehearsal has lost its main encoder and carried on using the backup.");
  }

  return {
    soakCount,
    soakTarget: TOTP_LIVE_SOAK_TARGET,
    failoverRehearsed,
    publicPermitted: blockers.length === 0,
    blockers,
  };
}

/** Public transmission is refused until the soak gate is met and the episode is cleared. */
export function totpLiveStartRefusal(params: {
  mode: TotpLiveMode;
  readiness: TotpLiveReadiness;
  publishReady: boolean;
  openSession: TotpLiveSessionSummary | null;
}): string | null {
  if (params.openSession && !["complete", "aborted"].includes(params.openSession.state)) {
    return "There is already an open transmission for this episode — finish or abort it first.";
  }
  if (!params.publishReady) {
    return "The episode is not cleared for broadcast yet — clear the control room checks first.";
  }
  if (params.mode === "public" && !params.readiness.publicPermitted) {
    return params.readiness.blockers[0] ?? "Public transmission is not unlocked yet.";
  }
  return null;
}
