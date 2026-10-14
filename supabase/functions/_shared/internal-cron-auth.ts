/**
 * Fail-closed authentication for privileged, scheduled Edge Function calls.
 *
 * This gate only accepts the server-side Vault cron secret. A bearer JWT, an
 * anon/publishable key or a client-supplied triggeredBy flag cannot authorize
 * finance operations. Never log or include the supplied secret in responses.
 */
export type InternalCronAuthResult = "authorized" | "unauthorized" | "unavailable";

export async function authorizeInternalCronRequest(
  request: Pick<Request, "headers">,
  verifySecret: (secret: string) => PromiseLike<{ data: boolean | null; error: unknown }>,
): Promise<InternalCronAuthResult> {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret.length < 32) return "unauthorized";

  try {
    const { data, error } = await verifySecret(secret);
    if (error) return "unavailable";
    return data === true ? "authorized" : "unauthorized";
  } catch {
    return "unavailable";
  }
}
