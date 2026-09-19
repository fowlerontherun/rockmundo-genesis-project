
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const EXPECTED_REPOSITORY = "fowlerontherun/rockmundo-genesis-project";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF =
  "fowlerontherun/rockmundo-genesis-project/.github/workflows/totp-render-worker.yml@refs/heads/main";
const EXPECTED_AUDIENCE = "rockmundo-totp-render";
const RENDER_BUCKET = "totp-broadcast-masters";
const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "image/jpeg",
  "text/vtt",
  "text/plain",
  "application/json",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>;
}

let jwksCache:
  | { expiresAt: number; keys: Array<Record<string, unknown>> }
  | null = null;

async function githubJwks(): Promise<Array<Record<string, unknown>>> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;
  const response = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks");
  if (!response.ok) throw new Error(`Could not load GitHub OIDC signing keys (${response.status}).`);
  const body = (await response.json()) as { keys?: Array<Record<string, unknown>> };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) throw new Error("GitHub OIDC returned no signing keys.");
  jwksCache = { expiresAt: now + 60 * 60 * 1000, keys };
  return keys;
}

interface GithubClaims {
  repository: string;
  repository_owner?: string;
  ref: string;
  workflow_ref?: string;
  event_name?: string;
  run_id?: string | number;
  run_attempt?: string | number;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
}

async function verifyGithubOidc(token: string): Promise<GithubClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed GitHub OIDC token.");
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]) as unknown as GithubClaims;
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unexpected GitHub OIDC signing algorithm.");
  }

  const key = (await githubJwks()).find((candidate) => candidate.kid === header.kid);
  if (!key) {
    jwksCache = null;
    const refreshed = (await githubJwks()).find((candidate) => candidate.kid === header.kid);
    if (!refreshed) throw new Error("GitHub OIDC signing key was not recognised.");
    Object.assign(key ?? {}, refreshed);
  }
  const selected = key ?? (await githubJwks()).find((candidate) => candidate.kid === header.kid);
  if (!selected) throw new Error("GitHub OIDC signing key was not recognised.");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    selected as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    decodeBase64Url(parts[2]),
    signed,
  );
  if (!valid) throw new Error("GitHub OIDC signature is invalid.");

  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== "https://token.actions.githubusercontent.com") throw new Error("Unexpected OIDC issuer.");
  if (!audience.includes(EXPECTED_AUDIENCE)) throw new Error("Unexpected OIDC audience.");
  if (!Number.isFinite(claims.exp) || claims.exp < now - 30) throw new Error("GitHub OIDC token has expired.");
  if (claims.nbf && claims.nbf > now + 30) throw new Error("GitHub OIDC token is not active yet.");
  if (claims.repository !== EXPECTED_REPOSITORY) throw new Error("Render request came from the wrong repository.");
  if (claims.ref !== EXPECTED_REF) throw new Error("Render workers may only run from the main branch.");
  if (claims.workflow_ref !== EXPECTED_WORKFLOW_REF) throw new Error("Render request came from an unapproved workflow.");
  if (!["schedule", "workflow_dispatch"].includes(String(claims.event_name ?? ""))) {
    throw new Error("Render request came from an unapproved GitHub event.");
  }
  return claims;
}

function workerId(claims: GithubClaims): string {
  return `github:${String(claims.run_id ?? "unknown")}:${String(claims.run_attempt ?? "1")}`;
}

function validSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

async function assertOwnedJob(
  service: ReturnType<typeof createClient>,
  jobId: string,
  id: string,
) {
  const { data, error } = await service
    .from("totp_render_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Render job not found.");
  if (data.state !== "rendering" || data.worker_id !== id) {
    throw new Error("This GitHub run no longer owns the render job lease.");
  }
  return data;
}

async function loadPayload(
  service: ReturnType<typeof createClient>,
  job: Record<string, unknown>,
) {
  const episodeId = String(job.episode_id ?? "");
  const checksum = String(job.manifest_checksum ?? "");

  const { error: archiveError } = await service.rpc("totp_build_episode_broadcast_replays", {
    p_episode_id: episodeId,
  });
  if (archiveError) throw new Error(`Could not freeze episode visuals: ${archiveError.message}`);

  const [{ data: manifestRow, error: manifestError }, { data: replays, error: replayError }] =
    await Promise.all([
      service
        .from("totp_episode_manifests")
        .select("manifest,checksum,production_state")
        .eq("episode_id", episodeId)
        .maybeSingle(),
      service
        .from("totp_broadcast_replays")
        .select("id,performance_id,replay_version,stage_key,presenter_key,duration_ms,checksum,generated_at,payload")
        .eq("episode_id", episodeId),
    ]);

  if (manifestError) throw new Error(manifestError.message);
  if (!manifestRow) throw new Error("The frozen episode manifest no longer exists.");
  if (manifestRow.checksum !== checksum) throw new Error("The frozen manifest checksum no longer matches the render job.");
  if (replayError) throw new Error(replayError.message);

  const manifest = manifestRow.manifest as Record<string, unknown>;
  const segments = Array.isArray(manifest?.segments) ? manifest.segments as Array<Record<string, unknown>> : [];
  const byPerformance = new Set((replays ?? []).map((row) => String(row.performance_id)));
  const missing = segments
    .map((segment) => String(segment.performance_id ?? ""))
    .filter((performanceId) => performanceId && !byPerformance.has(performanceId));
  if (missing.length) throw new Error(`Immutable broadcast replay missing for ${missing.join(", ")}.`);

  const sortedReplays = [...(replays ?? [])].sort(
    (a, b) => Number(a.payload?.runningOrder ?? 0) - Number(b.payload?.runningOrder ?? 0),
  );
  return { manifest, replays: sortedReplays };
}

async function loadProductionAudio(
  service: ReturnType<typeof createClient>,
  supabaseUrl: string,
  presenterKey: string,
) {
  const [{ data: sounds, error: soundsError }, { data: programme, error: programmeError }, { data: presenter, error: presenterError }] =
    await Promise.all([
      service
        .from("gig_crowd_sounds")
        .select("id,sound_type,audio_url,duration_seconds,intensity_level,updated_at")
        .eq("is_active", true)
        .in("sound_type", ["applause","ambient_chatter","crowd_cheer_medium","crowd_cheer_large"])
        .order("intensity_level"),
      service.storage.from("totp-media").list("programme", { limit: 100 }),
      service.storage.from("totp-media").list(`presenters/${presenterKey}`, { limit: 100 }),
    ]);
  if (soundsError) throw new Error(soundsError.message);
  if (programmeError) throw new Error(programmeError.message);
  if (presenterError) throw new Error(presenterError.message);

  const publicUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/totp-media/${path}`;
  const version = (entry: Record<string, unknown> | undefined) =>
    String(entry?.updated_at ?? entry?.created_at ?? "") || null;
  const programmeIntro = (programme ?? []).find((entry) => entry.name === "intro");
  const opening = (presenter ?? []).find((entry) => entry.name === "opening");
  const closing = (presenter ?? []).find((entry) => entry.name === "closing");

  return {
    crowd_sounds: (sounds ?? []).map((sound) => ({
      ...sound,
      id: String(sound.id),
      updated_at: sound.updated_at ?? null,
    })),
    production_media: {
      programme_intro: programmeIntro
        ? { url: publicUrl("programme/intro"), version: version(programmeIntro as Record<string, unknown>) }
        : null,
      opening: opening
        ? { url: publicUrl(`presenters/${presenterKey}/opening`), version: version(opening as Record<string, unknown>) }
        : null,
      closing: closing
        ? { url: publicUrl(`presenters/${presenterKey}/closing`), version: version(closing as Record<string, unknown>) }
        : null,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "GitHub OIDC token required." });
    let claims: GithubClaims;
    try {
      claims = await verifyGithubOidc(auth.slice(7));
    } catch (error) {
      return json(401, { error: error instanceof Error ? error.message : "GitHub OIDC verification failed." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !publishableKey) {
      throw new Error("Render gateway server credentials are unavailable.");
    }
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const id = workerId(claims);

    if (action === "ping") {
      return json(200, { ok: true, worker_id: id, repository: claims.repository, ref: claims.ref });
    }

    if (action === "claim") {
      const { data: rawJob, error } = await service.rpc("totp_claim_render_job_v2", { p_worker_id: id });
      if (error) throw new Error(error.message);
      const job = Array.isArray(rawJob) ? rawJob[0] : rawJob;
      if (!job?.id) return json(200, { job: null });
      try {
        const payload = await loadPayload(service, job as Record<string, unknown>);
        const presenterKey = String((payload.manifest as Record<string, unknown>)?.presenter_key ?? "alex_rayne");
        const audio = await loadProductionAudio(service, supabaseUrl, presenterKey);
        return json(200, { worker_id: id, job, ...payload, ...audio });
      } catch (error) {
        await service.rpc("totp_fail_render_job_v2", {
          p_job_id: job.id,
          p_worker_id: id,
          p_error: error instanceof Error ? error.message : "Could not freeze render payload",
        });
        throw error;
      }
    }

    const jobId = String(body.job_id ?? "");
    if (!jobId) return json(400, { error: "job_id is required." });
    const job = await assertOwnedJob(service, jobId, id);

    if (action === "heartbeat") {
      const progress = Number(body.progress_percent ?? job.progress_percent ?? 0);
      const { data, error } = await service.rpc("totp_heartbeat_render_job", {
        p_job_id: jobId,
        p_worker_id: id,
        p_progress_percent: Number.isFinite(progress) ? Math.max(0, Math.min(99, Math.round(progress))) : null,
      });
      if (error) throw new Error(error.message);
      return json(200, { job: data });
    }

    if (action === "upload_token") {
      const sha256 = String(body.sha256 ?? "");
      const storagePath = String(body.storage_path ?? "");
      const contentType = String(body.content_type ?? "application/octet-stream");
      if (!validSha(sha256)) return json(400, { error: "A valid SHA-256 is required." });
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) return json(400, { error: "Unsupported render artifact content type." });
      const prefix = `${job.episode_id}/${job.manifest_checksum}/${sha256}/`;
      if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
        return json(400, { error: "Artifact path does not belong to this render job." });
      }

      const parts = storagePath.split("/");
      const filename = parts.pop() ?? "";
      const folder = parts.join("/");
      const { data: existing, error: listError } = await service.storage
        .from(RENDER_BUCKET)
        .list(folder, { limit: 100, search: filename });
      if (listError) throw new Error(listError.message);
      if ((existing ?? []).some((entry) => entry.name === filename)) {
        return json(200, { exists: true, storage_path: storagePath });
      }

      const { data, error } = await service.storage
        .from(RENDER_BUCKET)
        .createSignedUploadUrl(storagePath, { upsert: false });
      if (error || !data?.token) throw new Error(error?.message ?? "Could not create artifact upload token.");

      const ref = new URL(supabaseUrl).hostname.split(".")[0];
      return json(200, {
        exists: false,
        storage_path: storagePath,
        token: data.token,
        publishable_key: publishableKey,
        tus_endpoint: `https://${ref}.storage.supabase.co/storage/v1/upload/resumable`,
      });
    }

    if (action === "complete") {
      const artifacts = Array.isArray(body.artifacts) ? body.artifacts as Array<Record<string, unknown>> : [];
      const expectedPrefix = `${job.episode_id}/${job.manifest_checksum}/`;
      for (const artifact of artifacts) {
        if (!validSha(artifact.sha256)) return json(400, { error: "Every artifact needs a valid SHA-256." });
        if (!String(artifact.storage_path ?? "").startsWith(expectedPrefix)) {
          return json(400, { error: "An artifact path does not belong to this render job." });
        }
      }
      if (!validSha(body.timeline_sha256) || !validSha(body.master_sha256) || !validSha(body.input_sha256)) {
        return json(400, { error: "Render completion requires valid master, timeline and input SHA-256 values." });
      }

      const { data, error } = await service.rpc("totp_complete_render_job_v2", {
        p_job_id: jobId,
        p_worker_id: id,
        p_artifacts: artifacts,
        p_qc: body.qc ?? {},
        p_probe: body.probe ?? {},
        p_timeline_sha256: body.timeline_sha256,
        p_master_sha256: body.master_sha256,
        p_input_sha256: body.input_sha256,
      });
      if (error) throw new Error(error.message);
      return json(200, { job: data });
    }

    if (action === "fail") {
      const { data, error } = await service.rpc("totp_fail_render_job_v2", {
        p_job_id: jobId,
        p_worker_id: id,
        p_error: String(body.error ?? "Render failed"),
      });
      if (error) throw new Error(error.message);
      return json(200, { job: data });
    }

    return json(400, { error: "Unknown render gateway action." });
  } catch (error) {
    console.error("[TOTP-RENDER-GATEWAY]", error);
    return json(500, { error: error instanceof Error ? error.message : "Unexpected render gateway error" });
  }
});
