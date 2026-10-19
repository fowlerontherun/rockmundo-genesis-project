// The 10-minute pg_cron job now executes
// public.process_due_self_promotions() inside Postgres, with no public HTTP
// authority. Keep a tombstone endpoint for stale callers; never use a
// service-role client from this public-facing route.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } });
  }
  return new Response(JSON.stringify({
    error: "Self-promotion completion has moved to the internal scheduler",
  }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});
