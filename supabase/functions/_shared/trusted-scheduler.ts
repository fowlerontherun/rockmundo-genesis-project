// Shared authorization for internal, global economy/lifecycle schedulers.
// The x-cron-secret never enters browser bundles or a literal pg_cron command.
// The caller must provide a service-role Supabase client and call this before
// reading the request body, writing job logs or processing game-world rows.
export async function authorizeInternalJob(
  req: Request,
  client: any,
  jobName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: authenticated, error: credentialError } = await client.rpc(
    "verify_internal_cron_secret", { p_secret: req.headers.get("x-cron-secret") },
  );
  if (credentialError || authenticated !== true) {
    console.warn("[internal-job] Untrusted scheduler request", jobName);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: claim, error: claimError } = await client.rpc(
    "claim_privileged_job_window", { p_job_name: jobName },
  );
  if (claimError) {
    console.error("[internal-job] Failed to claim scheduled job", jobName, claimError);
    return new Response(JSON.stringify({ error: "Cannot claim scheduled job" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (claim?.claimed !== true) {
    return new Response(JSON.stringify({
      success: true, skipped: true, reason: "already_claimed",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return null;
}
