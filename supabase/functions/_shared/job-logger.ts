import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

interface StartJobRunParams {
  jobName: string;
  functionName: string;
  supabaseClient: SupabaseClient<Record<string, unknown>, unknown, unknown>;
  triggeredBy?: string | null;
  requestPayload?: Json;
  requestId?: string | null;
}

interface CompleteJobRunParams {
  jobName: string;
  runId: string | null;
  supabaseClient: SupabaseClient<Record<string, unknown>, unknown, unknown>;
  durationMs?: number | null;
  processedCount?: number | null;
  errorCount?: number | null;
  itemsAffected?: number | null;
  resultSummary?: Json;
}

interface FailJobRunParams extends CompleteJobRunParams {
  error: unknown;
}

export async function safeJson<T>(req: Request): Promise<T | null> {
  try {
    return await req.clone().json();
  } catch (_error) {
    return null;
  }
}

export async function startJobRun({
  jobName,
  functionName,
  supabaseClient,
  triggeredBy,
  requestPayload,
  requestId,
}: StartJobRunParams): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient
      .from("admin_cron_job_runs")
      .insert({
        job_name: jobName,
        function_name: functionName,
        triggered_by: triggeredBy ?? "cron",
        request_payload: requestPayload ?? null,
        request_id: requestId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`[${jobName}] Failed to start job run log`, error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error(`[${jobName}] Unexpected error starting job run log`, error);
    return null;
  }
}

export async function completeJobRun({
  jobName,
  runId,
  supabaseClient,
  durationMs,
  processedCount,
  errorCount,
  itemsAffected,
  resultSummary,
}: CompleteJobRunParams): Promise<void> {
  if (!runId) return;

  const { error } = await supabaseClient
    .from("admin_cron_job_runs")
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs ?? null,
      processed_count: processedCount ?? null,
      error_count: errorCount ?? null,
      items_affected: itemsAffected ?? null,
      result_summary: resultSummary ?? null,
    })
    .eq("id", runId);

  if (error) {
    console.error(`[${jobName}] Failed to complete job run log`, error);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch (_error) {
    return "Unknown error";
  }
}

export async function failJobRun({
  jobName,
  runId,
  supabaseClient,
  durationMs,
  processedCount,
  errorCount,
  itemsAffected,
  resultSummary,
  error,
}: FailJobRunParams): Promise<void> {
  if (!runId) return;

  const errorMessage = getErrorMessage(error);
  const summary: Json =
    resultSummary ??
    ((error instanceof Error && error.stack)
      ? { error: errorMessage, stack: error.stack }
      : { error: errorMessage });

  const { error: updateError } = await supabaseClient
    .from("admin_cron_job_runs")
    .update({
      status: "error",
      finished_at: new Date().toISOString(),
      duration_ms: durationMs ?? null,
      processed_count: processedCount ?? null,
      error_count: errorCount ?? null,
      items_affected: itemsAffected ?? null,
      error_message: errorMessage,
      result_summary: summary,
    })
    .eq("id", runId);

  if (updateError) {
    console.error(`[${jobName}] Failed to record job run failure`, updateError);
  }
}
