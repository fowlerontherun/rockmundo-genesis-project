import { totpRpc } from "./rpc";
import type { TotpPreflightReport } from "./preflight";

export type TotpAuditEventKind = "rehearsal" | "preflight" | "approval" | "note" | "render" | "publish";

export interface TotpProductionAuditEntry {
  id: string;
  episode_id: string;
  event_kind: TotpAuditEventKind;
  headline: string;
  detail: Record<string, unknown>;
  passed: boolean | null;
  manifest_checksum: string | null;
  actor_id: string | null;
  created_at: string;
}

function normalise(row: unknown): TotpProductionAuditEntry {
  const entry = (row ?? {}) as Partial<TotpProductionAuditEntry>;
  return {
    id: String(entry.id ?? ""),
    episode_id: String(entry.episode_id ?? ""),
    event_kind: (entry.event_kind ?? "note") as TotpAuditEventKind,
    headline: String(entry.headline ?? ""),
    detail: (entry.detail ?? {}) as Record<string, unknown>,
    passed: entry.passed ?? null,
    manifest_checksum: entry.manifest_checksum ?? null,
    actor_id: entry.actor_id ?? null,
    created_at: String(entry.created_at ?? ""),
  };
}

export async function getTotpProductionAudit(episodeId: string, limit = 50): Promise<TotpProductionAuditEntry[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_episode_production_audit", {
    p_episode_id: episodeId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message || "Could not load the Top of the Pops production log.");
  return (Array.isArray(data) ? data : []).map(normalise);
}

export async function logTotpProductionEvent(params: {
  episodeId: string;
  eventKind: TotpAuditEventKind;
  headline: string;
  detail?: Record<string, unknown>;
  passed?: boolean | null;
  manifestChecksum?: string | null;
}): Promise<TotpProductionAuditEntry> {
  const { data, error } = await totpRpc<unknown>("totp_admin_log_production_event", {
    p_episode_id: params.episodeId,
    p_event_kind: params.eventKind,
    p_headline: params.headline,
    p_detail: params.detail ?? {},
    p_passed: params.passed ?? null,
    p_manifest_checksum: params.manifestChecksum ?? null,
  });
  if (error) throw new Error(error.message || "Could not save the production log entry.");
  return normalise(Array.isArray(data) ? data[0] : data);
}

/** Compact, storable summary of a preflight report for the production log. */
export function preflightAuditDetail(report: TotpPreflightReport): Record<string, unknown> {
  return {
    passed_checks: report.passedCount,
    total_checks: report.checks.length,
    blockers: report.blockers.map((item) => ({ code: item.code, detail: item.detail })),
    warnings: report.warnings.map((item) => ({ code: item.code, detail: item.detail })),
    production_state: report.productionState,
    render_ready: report.renderReady,
    publish_ready: report.publishReady,
  };
}

export function totpAuditKindLabel(kind: TotpAuditEventKind): string {
  switch (kind) {
    case "rehearsal":
      return "Rehearsal";
    case "preflight":
      return "Checks";
    case "approval":
      return "Sign-off";
    case "render":
      return "Export";
    case "publish":
      return "Published";
    default:
      return "Note";
  }
}
