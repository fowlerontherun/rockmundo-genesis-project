// #4242: the active hourly radio worker is now PostgreSQL pg_cron:
// SELECT public.process_hourly_radio_plays();
// This old service-role HTTP simulator is intentionally retired, including
// its read-modify-write economy mutations and anonymous replay path.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } });
  }
  return new Response(JSON.stringify({
    error: "Radio simulation runs only on its internal hourly schedule",
  }), { status: 410, headers: { "Content-Type": "application/json" } });
});
