import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase-types";
import { logger } from "../src/lib/logger";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AUDIO_API_URL", "AUDIO_API_KEY"] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AUDIO_API_URL = process.env.AUDIO_API_URL!;
const AUDIO_API_KEY = process.env.AUDIO_API_KEY!;
const STORAGE_BUCKET = process.env.AUDIO_STORAGE_BUCKET ?? "generated-audio-clips";
const rawBatchSize = Number(process.env.AUDIO_WORKER_BATCH_SIZE ?? "5");
const BATCH_SIZE = Number.isFinite(rawBatchSize) && rawBatchSize > 0 ? Math.floor(rawBatchSize) : 5;
const AUDIO_DURATION_SECONDS = 30;

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type PromptRow = Database["public"]["Tables"]["audio_generation_prompts"]["Row"];

type PromptStatus = PromptRow["status"];

type AudioApiSuccess = {
  audio_base64?: string;
  audioBase64?: string;
  audio_url?: string;
  audioUrl?: string;
  mime_type?: string;
  mimeType?: string;
  model_version?: string;
  modelVersion?: string;
  seed?: string | number;
  latency_ms?: number;
  latencyMs?: number;
  cost_cents?: number;
  costCents?: number;
  cost_usd?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

const decodeAudioPayload = async (payload: AudioApiSuccess) => {
  const audioUrl = typeof payload.audio_url === "string" ? payload.audio_url : payload.audioUrl;
  if (audioUrl) {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Unable to download audio from ${audioUrl}: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const audioBase64 = typeof payload.audio_base64 === "string" ? payload.audio_base64 : payload.audioBase64;
  if (audioBase64) {
    return Buffer.from(audioBase64, "base64");
  }

  throw new Error("Audio API response did not include audio_url or audio_base64");
};

const takePendingPrompts = async (): Promise<PromptRow[]> => {
  const { data, error } = await supabase
    .from("audio_generation_prompts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    throw error;
  }

  return data ?? [];
};

const updatePromptStatus = async (promptId: string, status: PromptStatus, patch: Partial<PromptRow> = {}) => {
  const { error } = await supabase
    .from("audio_generation_prompts")
    .update({ status, ...patch })
    .eq("id", promptId);

  if (error) {
    throw error;
  }
};

const callAudioApi = async (prompt: PromptRow): Promise<AudioApiSuccess> => {
  const response = await fetch(AUDIO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUDIO_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: prompt.prompt_text,
      duration: AUDIO_DURATION_SECONDS,
      model: prompt.target_model,
      sessionId: prompt.session_id,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audio API error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as AudioApiSuccess;
};

const uploadAudio = async (prompt: PromptRow, audioBuffer: Buffer, mimeType?: string) => {
  const fileExtension = mimeType?.split("/")[1] ?? "wav";
  const storagePath = `sessions/${prompt.session_id}/${prompt.id}-${randomUUID()}.${fileExtension}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: mimeType ?? "audio/wav",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  return { storagePath, publicUrl };
};

const saveResult = async (
  prompt: PromptRow,
  payload: AudioApiSuccess,
  storagePath: string,
  publicUrl: string,
) => {
  const metadataPayload: Record<string, unknown> = { ...payload };
  delete metadataPayload.audio_base64;
  delete metadataPayload.audioBase64;
  delete metadataPayload.audio_url;
  delete metadataPayload.audioUrl;

  const insertPayload: Database["public"]["Tables"]["audio_generation_results"]["Insert"] = {
    prompt_id: prompt.id,
    session_id: prompt.session_id,
    audio_storage_path: storagePath,
    audio_public_url: publicUrl,
    duration_seconds: AUDIO_DURATION_SECONDS,
    model_version: (payload.model_version as string) ?? (payload.modelVersion as string) ?? prompt.target_model,
    seed: payload.seed !== undefined ? String(payload.seed) : null,
    latency_ms: (payload.latency_ms as number) ?? (payload.latencyMs as number) ?? null,
    cost_cents:
      (payload.cost_cents as number) ??
      (payload.costCents as number) ??
      (typeof payload.cost_usd === "number" ? Math.round(payload.cost_usd * 100) : null),
    metadata: payload.metadata ?? metadataPayload,
  };

  const { error } = await supabase.from("audio_generation_results").insert(insertPayload);

  if (error) {
    throw error;
  }
};

const run = async () => {
  const prompts = await takePendingPrompts();
  if (prompts.length === 0) {
    logger.info("No pending audio prompts found");
    return;
  }

  logger.info("Starting audio generation run", { batchSize: prompts.length });

  let successCount = 0;
  let failureCount = 0;
  let totalLatency = 0;
  let latencySamples = 0;
  let totalCost = 0;

  for (const prompt of prompts) {
    try {
      await updatePromptStatus(prompt.id, "processing", { started_at: new Date().toISOString(), last_error: null });
      const payload = await callAudioApi(prompt);
      const audioBuffer = await decodeAudioPayload(payload);
      const mimeType = (payload.mime_type as string) ?? (payload.mimeType as string) ?? "audio/wav";
      const { storagePath, publicUrl } = await uploadAudio(prompt, audioBuffer, mimeType);
      await saveResult(prompt, payload, storagePath, publicUrl);
      await updatePromptStatus(prompt.id, "completed", { completed_at: new Date().toISOString(), last_error: null });

      successCount += 1;
      const latency = (payload.latency_ms as number) ?? (payload.latencyMs as number);
      if (typeof latency === "number") {
        totalLatency += latency;
        latencySamples += 1;
      }
      const cost =
        (payload.cost_cents as number) ??
        (payload.costCents as number) ??
        (typeof payload.cost_usd === "number" ? Math.round(payload.cost_usd * 100) : null);
      if (typeof cost === "number") {
        totalCost += cost;
      }

      logger.info("Audio clip generated", {
        promptId: prompt.id,
        sessionId: prompt.session_id,
        storagePath,
        modelVersion: payload.model_version ?? payload.modelVersion ?? prompt.target_model,
      });
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to process audio prompt", {
        promptId: prompt.id,
        sessionId: prompt.session_id,
        error: message,
      });
      await updatePromptStatus(prompt.id, "failed", { last_error: message });
    }
  }

  const processed = successCount + failureCount;
  const successRate = processed > 0 ? successCount / processed : 0;
  const averageLatencyMs = latencySamples > 0 ? Math.round(totalLatency / latencySamples) : null;

  logger.info("Audio generation run summary", {
    processed,
    successCount,
    failureCount,
    successRate,
    averageLatencyMs,
    totalCostCents: totalCost,
  });
};

run()
  .then(() => {
    logger.info("Audio generation worker completed");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Audio generation worker failed", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
