import { supabase } from "@/integrations/supabase/client";
import { GIG_EVENT_SCHEMA_VERSION, GIG_VIEWER_VERSION } from "../events/constants";
import { isSupportedReplayVersion, validateGigViewerReplay } from "../events/schema";
import type { GigReplayStatus, GigViewerReplay, GigViewerReplayLoadState } from "../events/types";
import { normalizeCrowdTuning } from "../viewer/engine/CrowdTuning";
import logger from "@/lib/logger";
import {
  createGigExperienceLoadError,
  isGigSchemaCompatibilityError,
  logGigExperienceFallback,
} from "../diagnostics";

type ReplayPayload = {
  events?: unknown[];
  crowdTuning?: unknown;
  crowdTuningRevision?: unknown;
  commerce?: unknown;
};
type ReplayRow = { id: string; gig_id: string; gig_outcome_id: string; viewer_version: number; event_schema_version: number; simulation_seed: string; duration_ms: number; event_payload: ReplayPayload | unknown[]; generated_at: string; generation_status: GigReplayStatus; checksum: string | null };
export interface GigViewerReplayResult { state: GigViewerReplayLoadState; replay: GigViewerReplay | null; reason?: string }

export async function getGigViewerReplay(gigId: string): Promise<GigViewerReplayResult> {
  const { data, error } = await (supabase as any)
    .from("gig_viewer_replays")
    .select("id,gig_id,gig_outcome_id,viewer_version,event_schema_version,simulation_seed,duration_ms,event_payload,generated_at,generation_status,checksum")
    .eq("gig_id", gigId)
    .order("generated_at", { ascending: false })
    .limit(5);
  if (error && isGigSchemaCompatibilityError(error)) {
    logGigExperienceFallback(
      gigId,
      "replay",
      "gig_viewer_replays",
      error,
      "treat the stored replay as unavailable and preserve report access",
    );
    return { state: "unavailable", replay: null, reason: "schema_unavailable" };
  }
  if (error) throw createGigExperienceLoadError(gigId, "replay", "gig_viewer_replays", error);
  const rows = (data ?? []) as ReplayRow[];
  if (!rows.length) return { state: "unavailable", replay: null, reason: "legacy_unavailable" };
  const row = rows.find((candidate) => candidate.viewer_version === GIG_VIEWER_VERSION) ?? rows[0];
  if (row.generation_status === "generating") return { state: "generating", replay: null };
  if (row.generation_status === "failed") return { state: "failed", replay: null };
  if (row.generation_status === "legacy_unavailable") return { state: "unavailable", replay: null, reason: "legacy_unavailable" };
  if (!isSupportedReplayVersion(row.viewer_version, row.event_schema_version)) {
    logGigExperienceFallback(
      gigId,
      "replay",
      "gig_viewer_replays",
      { code: "UNSUPPORTED_REPLAY_VERSION", message: `Viewer ${row.viewer_version}, event schema ${row.event_schema_version}` },
      "use the authoritative result report",
    );
    return { state: "unsupported_version", replay: null };
  }

  const payload = Array.isArray(row.event_payload) ? null : row.event_payload as ReplayPayload;
  const events = Array.isArray(row.event_payload) ? row.event_payload : payload?.events;
  const revision = Number(payload?.crowdTuningRevision);
  const replay: GigViewerReplay = {
    id: row.id,
    gigId: row.gig_id,
    gigOutcomeId: row.gig_outcome_id,
    viewerVersion: row.viewer_version,
    eventSchemaVersion: row.event_schema_version,
    simulationSeed: row.simulation_seed,
    durationMs: row.duration_ms,
    generatedAt: row.generated_at,
    events: (events ?? []) as GigViewerReplay["events"],
    checksum: row.checksum,
    status: row.generation_status,
    crowdTuning: payload?.crowdTuning ? normalizeCrowdTuning(payload.crowdTuning as any) : null,
    crowdTuningRevision: Number.isFinite(revision) && revision > 0 ? revision : null,
    commerce: payload?.commerce as GigViewerReplay["commerce"] ?? null,
  };
  if (replay.eventSchemaVersion !== GIG_EVENT_SCHEMA_VERSION) return { state: "unsupported_version", replay: null };
  const validation = validateGigViewerReplay(replay);
  if (!validation.valid) {
    logGigExperienceFallback(
      gigId,
      "replay",
      "gig_viewer_replays.event_payload",
      { code: "MALFORMED_REPLAY", message: validation.errors.join("; ") },
      "use the authoritative result report",
    );
    return { state: "failed", replay: null, reason: "malformed_replay" };
  }
  logger.info("Gig viewer replay loaded", { scope: "gig-experience", gigId, replayId: row.id, eventCount: replay.events.length, durationMs: replay.durationMs, crowdTuningRevision: replay.crowdTuningRevision });
  return { state: "ready", replay };
}
