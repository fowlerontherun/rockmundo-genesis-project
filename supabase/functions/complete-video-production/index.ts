// #4253: scheduled music-video production completion now runs entirely inside
// PostgreSQL using run_music_video_production_completion_scheduled().
// The previous unauthenticated Edge worker had non-atomic reward side effects.
// This retired URL must never contain a service-role client or settle rewards.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
  }
  return new Response(JSON.stringify({
    error: "video_production_completion_runs_only_on_internal_schedule",
  }), {
    status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
