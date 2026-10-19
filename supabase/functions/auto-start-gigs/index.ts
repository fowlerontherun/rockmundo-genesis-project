// #4221: gig starts run exclusively from PostgreSQL's internal pg_cron
// worker (public.run_auto_start_gigs_scheduled). The former public HTTP
// endpoint is intentionally retired: never restore its service-role client.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } });
  }
  return new Response(JSON.stringify({
    error: "Scheduled gig starts run only on the internal minute scheduler",
  }), { status: 410, headers: { "Content-Type": "application/json" } });
});
