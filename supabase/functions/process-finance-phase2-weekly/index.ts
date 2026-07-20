import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("process_due_financial_obligations", {
    p_as_of_date: today,
    p_limit: 100,
  });

  if (error) {
    console.error("Universal obligations scheduler failed", error);
    throw error;
  }

  return new Response(JSON.stringify({ processed: data?.attempted ?? 0, result: data, engine: "financial_obligations" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
