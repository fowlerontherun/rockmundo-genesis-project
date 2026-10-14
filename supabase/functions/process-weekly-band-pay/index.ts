/**
 * Retired unsafe service-role HTTP payroll endpoint.
 *
 * Payroll is now invoked solely by the internal Saturday pg_cron job:
 *   SELECT public.process_weekly_band_payroll();
 *
 * Never restore service-role payouts to this publicly routable endpoint.
 * Legacy HTTP cron calls receive 410 and perform no database writes.
 */
Deno.serve((request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Allow": "POST, OPTIONS" } });
  }
  return new Response(JSON.stringify({
    error: "weekly_payroll_http_endpoint_retired",
    message: "Band payroll is scheduled internally by the database.",
  }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
