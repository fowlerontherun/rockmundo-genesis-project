import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { simulateFestivalPerformance, type FestivalJobSnapshot } from "./simulation.ts";

const headers = { "content-type": "application/json" };
const transient = (error: unknown) => /timeout|network|fetch|temporar|connection/i.test(String(error));

Deno.serve(async request => {
  if (request.headers.get("x-worker-secret") !== Deno.env.get("FESTIVAL_WORKER_SECRET")) return new Response("Forbidden", { status: 403 });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const worker = `festival-worker:${crypto.randomUUID()}`;
  const { data: recovered = 0 } = await client.rpc("recover_stale_festival_performance_simulation_jobs", { p_lease_seconds: 300 });
  const { data: invocation } = await client.from("festival_simulation_worker_invocations")
    .insert({ worker_id: worker, status: "running", recovered_leases: recovered }).select("id").single();
  const { data: job, error: claimError } = await client.rpc("claim_festival_performance_simulation_job", { p_worker: worker });
  if (claimError) {
    if (invocation) await client.from("festival_simulation_worker_invocations").update({ status: "failed", error_code: claimError.message, completed_at: new Date().toISOString() }).eq("id", invocation.id);
    return new Response(JSON.stringify({ error: claimError.message }), { status: 503, headers });
  }
  if (!job) {
    if (invocation) await client.from("festival_simulation_worker_invocations").update({ status: "succeeded", completed_at: new Date().toISOString() }).eq("id", invocation.id);
    return new Response(JSON.stringify({ processed: false, recoveredLeases: recovered }), { headers });
  }
  try {
    const { data: valid, error: validationError } = await client.rpc("validate_festival_performance_simulation_input", { p_job: job.id, p_input_digest: job.input_digest });
    if (validationError || valid !== true) throw new Error("festival_simulation_input_digest_mismatch");
    const output = simulateFestivalPerformance(job.input_snapshot as FestivalJobSnapshot, job.input_digest);
    const { data, error } = await client.rpc("complete_festival_performance_simulation_job", { p_job: job.id, p_worker: worker, p_input_digest: job.input_digest, p_output: output });
    if (error) throw error;
    if (invocation) await client.from("festival_simulation_worker_invocations").update({ status: "succeeded", processed_job_id: job.id, completed_at: new Date().toISOString() }).eq("id", invocation.id);
    return new Response(JSON.stringify({ processed: true, result: data }), { headers });
  } catch (error) {
    const { error: failureError } = await client.rpc("fail_festival_performance_simulation_job", { p_job: job.id, p_worker: worker, p_error: String(error), p_retryable: transient(error) });
    if (invocation) await client.from("festival_simulation_worker_invocations").update({ status: "failed", processed_job_id: job.id, error_code: String(error).slice(0, 500), completed_at: new Date().toISOString() }).eq("id", invocation.id);
    return new Response(JSON.stringify({ processed: false, error: String(error), failureError: failureError?.message }), { status: transient(error) ? 503 : 422, headers });
  }
});
