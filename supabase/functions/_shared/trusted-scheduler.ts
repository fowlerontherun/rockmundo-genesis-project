// Shared authorization for internal, global economy/lifecycle schedulers.
// The x-cron-secret never enters browser bundles or a literal pg_cron command.
// Call this before reading the request body, writing job logs or processing rows.
interface InternalSchedulerClient {
  rpc(name: string, args: Record<string, string>): PromiseLike<{ data: unknown; error: unknown }>;
}

// A scheduler secret is a short Vault-managed token. Do not forward arbitrary
// multi-megabyte HTTP headers to a privileged database verifier.
const MAX_INTERNAL_CRON_SECRET_LENGTH = 4_096;

export async function verifyInternalCronRequest(
  req: Request,
  client: InternalSchedulerClient,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const secret = req.headers.get("x-cron-secret");
  // Missing credentials are denied without even invoking a privileged RPC.
  if (!secret || secret.length > MAX_INTERNAL_CRON_SECRET_LENGTH) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let authenticated: unknown;
  try {
    const { data, error } = await client.rpc("verify_internal_cron_secret", { p_secret: secret });
    if (error) throw error;
    authenticated = data;
  } catch (_error) {
    authenticated = false;
  }
  if (authenticated !== true) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

// The six lifecycle schedulers additionally claim their official time window.
export async function authorizeInternalJob(
  req: Request,
  client: InternalSchedulerClient,
  jobName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const rejected = await verifyInternalCronRequest(req, client, corsHeaders);
  if (rejected) return rejected;
  let claim: { claimed?: boolean } | null = null;
  let claimError: unknown = null;
  try {
    const result = await client.rpc("claim_privileged_job_window", { p_job_name: jobName });
    claim = result.data as { claimed?: boolean } | null;
    claimError = result.error;
  } catch (error) {
    claimError = error;
  }
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
