import { supabase } from "@/integrations/supabase/client";
import { totpRpc } from "./rpc";
import { buildTotpRenderPlan, type TotpRenderPlan } from "./renderSpec";
import type { TotpEpisodeManifest } from "./episodeManifest";

export type TotpRenderJobState = "queued" | "rendering" | "succeeded" | "failed" | "cancelled";

export interface TotpRenderArtifact {
  kind: "master" | "youtube" | "proxy" | "poster" | "thumbnail" | "captions" | "chapters" | `thumbnail_${number}`;
  filename: string;
  storage_path?: string | null;
  url: string | null;
  bytes: number | null;
  sha256: string | null;
  content_type?: string | null;
}

export interface TotpRenderJob {
  id: string;
  episode_id: string;
  manifest_checksum: string;
  state: TotpRenderJobState;
  attempts: number;
  plan: TotpRenderPlan | Record<string, never>;
  artifacts: TotpRenderArtifact[];
  qc: { passed?: boolean; failures?: { code: string; detail: string }[] } | Record<string, never>;
  error_message: string | null;
  requested_by: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  progress_percent: number;
  progress_stage: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  max_attempts: number;
  output_metadata: Record<string, unknown>;
  probe: Record<string, unknown>;
  timeline_sha256: string | null;
  master_sha256: string | null;
  input_sha256: string | null;
}

function normaliseJob(row: unknown): TotpRenderJob {
  const job = (row ?? {}) as Partial<TotpRenderJob>;
  return {
    id: String(job.id ?? ""),
    episode_id: String(job.episode_id ?? ""),
    manifest_checksum: String(job.manifest_checksum ?? ""),
    state: (job.state ?? "queued") as TotpRenderJobState,
    attempts: Number(job.attempts ?? 0),
    plan: (job.plan ?? {}) as TotpRenderJob["plan"],
    artifacts: Array.isArray(job.artifacts) ? job.artifacts : [],
    qc: (job.qc ?? {}) as TotpRenderJob["qc"],
    error_message: job.error_message ?? null,
    requested_by: job.requested_by ?? null,
    claimed_at: job.claimed_at ?? null,
    started_at: job.started_at ?? null,
    finished_at: job.finished_at ?? null,
    created_at: String(job.created_at ?? ""),
    updated_at: String(job.updated_at ?? ""),
    progress_percent: Number(job.progress_percent ?? 0),
    progress_stage: job.progress_stage ?? null,
    worker_id: job.worker_id ?? null,
    heartbeat_at: job.heartbeat_at ?? null,
    max_attempts: Number(job.max_attempts ?? 3),
    output_metadata:
      job.output_metadata && typeof job.output_metadata === "object" && !Array.isArray(job.output_metadata)
        ? job.output_metadata as Record<string, unknown>
        : {},
    probe:
      job.probe && typeof job.probe === "object" && !Array.isArray(job.probe)
        ? job.probe as Record<string, unknown>
        : {},
    timeline_sha256: job.timeline_sha256 ?? null,
    master_sha256: job.master_sha256 ?? null,
    input_sha256: job.input_sha256 ?? null,
  };
}

export async function getTotpRenderJobs(episodeId?: string | null): Promise<TotpRenderJob[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_episode_render_jobs", {
    p_episode_id: episodeId ?? null,
  });
  if (error) throw new Error(error.message || "Could not load Top of the Pops render jobs.");
  return (Array.isArray(data) ? data : []).map(normaliseJob);
}

export async function enqueueTotpRender(manifest: TotpEpisodeManifest): Promise<TotpRenderJob> {
  const plan = buildTotpRenderPlan(manifest);
  const { data, error } = await totpRpc<unknown>("totp_admin_enqueue_render", {
    p_episode_id: manifest.episode_id,
    p_manifest_checksum: manifest.checksum,
    p_plan: plan as unknown as Record<string, unknown>,
  });
  if (error) throw new Error(error.message || "Could not queue the Top of the Pops render.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Top of the Pops returned no render job.");
  return normaliseJob(row);
}

export async function cancelTotpRender(jobId: string): Promise<TotpRenderJob> {
  const { data, error } = await totpRpc<unknown>("totp_admin_cancel_render", { p_job_id: jobId });
  if (error) throw new Error(error.message || "Could not cancel the Top of the Pops render.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Top of the Pops returned no cancelled render job.");
  return normaliseJob(row);
}

export function activeTotpRenderJob(jobs: TotpRenderJob[]): TotpRenderJob | null {
  return jobs.find((job) => job.state === "queued" || job.state === "rendering") ?? null;
}

export function latestSucceededTotpRender(jobs: TotpRenderJob[], manifestChecksum?: string | null): TotpRenderJob | null {
  return (
    jobs.find(
      (job) => job.state === "succeeded" && (!manifestChecksum || job.manifest_checksum === manifestChecksum),
    ) ?? null
  );
}

export function totpRenderStateLabel(state: TotpRenderJobState): string {
  switch (state) {
    case "queued":
      return "Waiting to render";
    case "rendering":
      return "Rendering now";
    case "succeeded":
      return "Ready to publish";
    case "failed":
      return "Render failed";
    case "cancelled":
      return "Cancelled";
    default:
      return state;
  }
}


export async function resolveTotpRenderArtifactUrl(
  artifact: TotpRenderArtifact,
  expiresInSeconds = 3_600,
): Promise<string | null> {
  const value = artifact.url?.trim();
  if (!value) return null;
  if (!value.startsWith("supabase://")) return value;

  const target = value.slice("supabase://".length);
  const slash = target.indexOf("/");
  if (slash <= 0 || slash === target.length - 1) {
    throw new Error("The render artifact storage address is invalid.");
  }
  const bucket = target.slice(0, slash);
  const path = target.slice(slash + 1);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message || "Could not open the render artifact.");
  return data.signedUrl;
}
