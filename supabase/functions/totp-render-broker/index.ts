import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));
const AUDIENCE = "rockmundo-totp-render";
const REPOSITORY = "fowlerontherun/rockmundo-genesis-project";
const WORKFLOW_PATH = ".github/workflows/totp-render-worker.yml";
const BUCKET = "totp-broadcast-masters";

interface GitHubClaims {
  repository?: string;
  ref?: string;
  event_name?: string;
  workflow_ref?: string;
  job_workflow_ref?: string;
  run_id?: string;
  run_attempt?: string;
}

async function authorize(req: Request): Promise<GitHubClaims> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Missing GitHub Actions identity token.");

  const { payload } = await jwtVerify(token, GITHUB_JWKS, {
    issuer: GITHUB_ISSUER,
    audience: AUDIENCE,
  });
  const claims = payload as GitHubClaims;
  if (claims.repository !== REPOSITORY) throw new Error("Render identity belongs to a different repository.");
  if (claims.ref !== "refs/heads/main") throw new Error("Only the main branch can claim production render jobs.");
  if (!["schedule", "workflow_dispatch"].includes(String(claims.event_name ?? ""))) {
    throw new Error("Only scheduled or manually dispatched render workflows are accepted.");
  }
  const workflowRef = String(claims.workflow_ref ?? claims.job_workflow_ref ?? "");
  if (!workflowRef.includes(`${REPOSITORY}/${WORKFLOW_PATH}@`)) {
    throw new Error("Render identity was not issued to the approved workflow.");
  }
  return claims;
}

function text(value: unknown, label: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function safeFileName(value: unknown): string {
  const file = text(value, "Artifact filename");
  if (file.includes("/") || file.includes("\\") || file === "." || file === "..") {
    throw new Error("Artifact filename is invalid.");
  }
  return file;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let claims: GitHubClaims;
  try {
    claims = await authorize(req);
  } catch (error) {
    return json(403, { error: error instanceof Error ? error.message : "Render identity rejected." });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "A JSON request body is required." });
  }

  const operation = String(body.operation ?? "");
  const workerId = String(body.workerId ?? `github-${claims.run_id ?? "unknown"}-${claims.run_attempt ?? "1"}`).slice(0, 180);

  try {
    if (operation === "claim") {
      const { data: job, error: claimError } = await service.rpc("totp_claim_render_job_v2", {
        p_worker_id: workerId,
      });
      if (claimError) throw claimError;
      if (!job?.id) return json(200, { job: null, workerId });

      const failClaim = async (message: string) => {
        await service.rpc("totp_fail_render_job_v2", {
          p_job_id: job.id,
          p_worker_id: workerId,
          p_error: message,
        });
        throw new Error(message);
      };

      const { data: stored, error: manifestError } = await service
        .from("totp_episode_manifests")
        .select("episode_id,checksum,production_state,manifest")
        .eq("episode_id", job.episode_id)
        .maybeSingle();
      if (manifestError) await failClaim(manifestError.message);
      if (!stored) await failClaim("The frozen episode manifest no longer exists.");
      if (stored.checksum !== job.manifest_checksum) await failClaim("The frozen manifest checksum changed after this render was queued.");
      if (!["production_ready", "rendered_master"].includes(String(stored.production_state))) {
        await failClaim(`Episode is ${stored.production_state}; it must be signed off before rendering.`);
      }

      const { data: replayRows, error: replayError } = await service
        .from("totp_broadcast_replays")
        .select("id,performance_id,replay_version,stage_key,presenter_key,duration_ms,checksum,generated_at,payload")
        .eq("episode_id", job.episode_id);
      if (replayError) await failClaim(replayError.message);
      const replays = [...(replayRows ?? [])].sort(
        (a, b) => Number(a.payload?.runningOrder ?? 0) - Number(b.payload?.runningOrder ?? 0),
      );
      const expectedIds = new Set((stored.manifest?.segments ?? []).map((row: { performance_id?: string }) => row.performance_id).filter(Boolean));
      const receivedIds = new Set(replays.map((row) => row.performance_id));
      const missing = [...expectedIds].filter((id) => !receivedIds.has(id));
      if (missing.length) await failClaim(`Broadcast archive is missing ${missing.length} frozen performance replay(s).`);

      const { data: crowdSounds, error: crowdError } = await service
        .from("gig_crowd_sounds")
        .select("id,sound_type,audio_url,intensity_level,duration_seconds")
        .eq("is_active", true)
        .in("sound_type", ["crowd_cheer_small","crowd_cheer_medium","crowd_cheer_large","crowd_singing","applause","ambient_chatter"])
        .order("intensity_level");
      if (crowdError) await failClaim(crowdError.message);

      return json(200, {
        workerId,
        job,
        manifest: stored.manifest,
        plan: job.plan,
        replays,
        crowdSounds: crowdSounds ?? [],
      });
    }

    const jobId = text(body.jobId, "Render job id");

    if (operation === "heartbeat") {
      const progress = body.progress == null ? null : Math.max(0, Math.min(99, Math.round(Number(body.progress))));
      const { data, error } = await service.rpc("totp_heartbeat_render_job", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_progress_percent: progress,
      });
      if (error) throw error;
      return json(200, { job: data });
    }

    if (operation === "upload_slots") {
      const { data: lease, error: leaseError } = await service
        .from("totp_render_jobs")
        .select("id,episode_id,manifest_checksum,state,worker_id")
        .eq("id", jobId)
        .maybeSingle();
      if (leaseError) throw leaseError;
      if (!lease || lease.state !== "rendering" || lease.worker_id !== workerId) {
        return json(409, { error: "This worker no longer owns the render job." });
      }

      const requested = Array.isArray(body.artifacts) ? body.artifacts as Array<Record<string, unknown>> : [];
      if (!requested.length || requested.length > 12) throw new Error("One to twelve artifact upload slots are required.");
      const prefix = `${lease.episode_id}/${lease.manifest_checksum}/${lease.id}`;
      const slots = [];
      for (const artifact of requested) {
        const filename = safeFileName(artifact.filename);
        const path = `${prefix}/${filename}`;
        const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
        if (error || !data?.token) throw error ?? new Error(`Could not create upload slot for ${filename}.`);
        slots.push({
          kind: String(artifact.kind ?? "artifact"),
          filename,
          path,
          token: data.token,
          contentType: String(artifact.contentType ?? "application/octet-stream"),
        });
      }

      const projectRef = new URL(Deno.env.get("SUPABASE_URL") ?? "").hostname.split(".")[0];
      return json(200, {
        slots,
        resumableEndpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      });
    }

    if (operation === "complete") {
      const artifacts = Array.isArray(body.artifacts) ? body.artifacts as Array<Record<string, unknown>> : [];
      if (!artifacts.length) throw new Error("Completed renders must include stored artifacts.");

      const { data: lease, error: leaseError } = await service
        .from("totp_render_jobs")
        .select("id,episode_id,manifest_checksum,state,worker_id")
        .eq("id", jobId)
        .maybeSingle();
      if (leaseError) throw leaseError;
      if (!lease || lease.state !== "rendering" || lease.worker_id !== workerId) {
        return json(409, { error: "This worker no longer owns the render job." });
      }
      const prefix = `${lease.episode_id}/${lease.manifest_checksum}/${lease.id}`;
      const { data: storedFiles, error: listError } = await service.storage.from(BUCKET).list(prefix, { limit: 100 });
      if (listError) throw listError;
      const storedNames = new Set((storedFiles ?? []).map((row) => row.name));
      for (const artifact of artifacts) {
        const filename = safeFileName(artifact.filename);
        if (artifact.storage_path !== `${prefix}/${filename}` || !storedNames.has(filename)) {
          throw new Error(`Stored render artifact ${filename} could not be verified.`);
        }
      }

      const { data, error } = await service.rpc("totp_complete_render_job_v2", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_artifacts: artifacts,
        p_qc: body.qc ?? {},
        p_probe: body.probe ?? {},
        p_timeline_sha256: body.timelineSha256 ?? null,
        p_master_sha256: body.masterSha256 ?? null,
        p_input_sha256: body.inputSha256 ?? null,
      });
      if (error) throw error;
      return json(200, { job: data });
    }

    if (operation === "fail") {
      const { data, error } = await service.rpc("totp_fail_render_job_v2", {
        p_job_id: jobId,
        p_worker_id: workerId,
        p_error: String(body.error ?? "Render worker failed."),
      });
      if (error) throw error;
      return json(200, { job: data });
    }

    return json(400, { error: "Unknown render broker operation." });
  } catch (error) {
    console.error("[TOTP-RENDER-BROKER]", operation, error);
    return json(500, { error: error instanceof Error ? error.message : "Unexpected render broker error." });
  }
});
