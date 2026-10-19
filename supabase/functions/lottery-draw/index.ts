// Retired: the only supported weekly lottery authority is the database's
// service-role-only process_weekly_lottery_draw(), scheduled via pg_cron.
// Issue #4224: never reintroduce service-role RPCs to this public endpoint.
// Anonymous requests are rejected by the JWT gateway; authenticated requests
// receive 410 Gone, including requests made before the draw cutoff.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "lottery_draw_scheduler_only",
      message: "Weekly lottery draws are processed by the internal database scheduler.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
