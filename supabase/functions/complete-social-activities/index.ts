import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();
  const { data: activities, error } = await supabase
    .from("social_activities")
    .select("id")
    .in("status", ["confirmed", "in_progress"])
    .lte("end_at", now)
    .limit(100);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const activity of activities ?? []) {
    const { error: completeError } = await supabase.rpc("complete_social_activity", { p_activity_id: activity.id });
    results.push({ id: activity.id, ok: !completeError, error: completeError?.message });
  }
  return new Response(JSON.stringify({ processed: results.length, results }), { headers: { "content-type": "application/json" } });
});
