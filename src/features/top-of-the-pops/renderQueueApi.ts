import { supabase } from "@/integrations/supabase/client";
import { totpRpc } from "./rpc";
import { buildTotpRenderPlan, type TotpRenderPlan } from "./renderSpec";
import type { TotpEpisodeManifest } from "./episodeManifest";

export const TOTP_RENDER_BUCKET = "totp-broadcast-masters";

export type TotpRenderJobState = "queued" | "rendering" | "succeeded" | "failed" | "cancelled";

export interface TotpRenderArtifact {
  kind: "master" | "proxy" | "poster" | "thumbnail" | "captions" | "chapters";
  filename: string;
  url: string | null;
  storage_path?: string | null;
  label?: string | null;
  bytes: number | null;
  sha256: string | null;
}

export interface TotpRenderJob {
  id: string;
  episode_id: string;
  manifest_checksum: string;
  state: TotpRenderJobState;
  attempts: number;
  progress_percent: number;
  worker_id: string | null;
  plan: TotpRenderPlan | Record<string, never>;
  artifacts: TotpRenderArtifact[];
  qc: { passed?: boolean; failures?: { code: string; detail: string }[] } | Record<string, never>;
  probe: Record<string, unknown>;
  timeline_sha256: string | null;
  master_sha256: string | null;
  input_sha256: string | null;
  error_message: string | null;
  requested_by: string | null;
  claimed_at: string | null;
  started_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function normaliseArtifact(value: unknown): TotpRenderArtifact {
  const artifact = (value ?? {}) as Partial<TotpRenderArtifact>;
  return {
    kind: (artifact.kind ?? "master") as TotpRenderArtifact["kind"],
    filename: String(artifact.filename ?? ""),
    url: artifact.url ?? null,
    storage_path: artifact.storage_path ?? null,
    label: artifact.label ?? null,
    bytes: artifact.bytes === null || artifact.bytes === undefined ? null : Number(artifact.bytes),
    sha256: artifact.sha256 ?? null,
  };
}

function normaliseJob(row: unknown): TotpRenderJob {
  const job = (row ?? {}) as Partial<TotpRenderJob>;
  return {
    id: String(job.id ?? ""),
    episode_id: String(job.episode_id ?? ""),
    manifest_checksum: String(job.manifest_checksum ?? ""),
    state: (job.state ?? "queued") as TotpRenderJobState,
    attempts: Number(job.attempts ?? 0),
    progress_percent: Math.max(0, Math.min(100, Number(job.progress_percent ?? 0))),
    worker_id: job.worker_id ?? null,
    plan: (job.plan ?? {}) as TotpRenderJob["plan"],
    artifacts: Array.isArray(job.artifacts) ? job.artifacts.map(normaliseArtifact) : [],
    qc: (job.qc ?? {}) as TotpRenderJob["qc"],
    probe: (job.probe ?? {}) as Record<string, unknown>,
    timeline_sha256: job.timeline_sha256 ?? null,
    master_sha256: job.master_sha256 ?? null,
    input_sha256: job.input_sha256 ?? null,
    error_message: job.error_message ?? null,
    requested_by: job.requested_by ?? null,
    claimed_at: job.claimed_at ?? null,
    started_at: job.started_at ?? null,
    heartbeat_at: job.heartbeat_at ?? null,
    finished_at: job.finished_at ?? null,
    created_at: String(job.created_at ?? ""),
    updated_at: String(job.updated_at ?? ""),
  };
}

export async function getTotpRenderJobs(episodeId?: string | null): Promise<TotpRenderJob[]> {
  const { data, error } = await totpRpc<unknown[]>("totp_episode_render_jobs", { p_episode_id: episodeId ?? null });
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
  return normaliseJob(Array.isArray(data) ? data[0] : data);
}

export async function cancelTotpRender(jobId: string): Promise<TotpRenderJob> {
  const { data, error } = await totpRpc<unknown>("totp_admin_cancel_render", { p_job_id: jobId });
  if (error) throw new Error(error.message || "Could not cancel the Top of the Pops render.");
  return normaliseJob(Array.isArray(data) ? data[0] : data);
}

export async function getTotpRenderArtifactUrl(artifact: TotpRenderArtifact, expiresIn = 3600): Promise<string | null> {
  if (artifact.url) return artifact.url;
  if (!artifact.storage_path) return null;
  const { data, error } = await supabase.storage.from(TOTP_RENDER_BUCKET).createSignedUrl(artifact.storage_path, expiresIn);
  if (error) throw new Error(error.message || "Could not open the rendered file.");
  return data?.signedUrl ?? null;
}

export function activeTotpRenderJob(jobs: TotpRenderJob[]): TotpRenderJob | null {
  return jobs.find((job) => job.state === "queued" || job.state === "rendering") ?? null;
}

export function latestSucceededTotpRender(jobs: TotpRenderJob[], manifestChecksum?: string | null): TotpRenderJob | null {
  return jobs.find((job) => job.state === "succeeded" && (!manifestChecksum || job.manifest_checksum === manifestChecksum)) ?? null;
}

export function totpRenderStateLabel(state: TotpRenderJobState): string {
  switch (state) {
    case "queued": return "Waiting to render";
    case "rendering": return "Rendering now";
    case "succeeded": return "Master approved";
    case "failed": return "Render failed";
    case "cancelled": return "Cancelled";
    default: return state;
  }
}
