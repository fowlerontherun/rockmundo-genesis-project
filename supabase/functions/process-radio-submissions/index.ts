// #4243: radio reviews run only inside PostgreSQL pg_cron.
// The former public service-role HTTP processor is retired.
Deno.serve(req => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } });
  }
  return new Response(JSON.stringify({
    error: "Radio reviews now run on their internal schedule",
  }), { status: 410, headers: { "Content-Type": "application/json" } });
});
