import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const now = new Date().toISOString();
    
    // Find accepted PR offers whose proposed_date has passed
    const { data: dueOffers, error: fetchError } = await supabaseClient
      .from('pr_media_offers')
      .select('id')
      .eq('status', 'accepted')
      .lt('proposed_date', now.split('T')[0]);

    if (fetchError) throw fetchError;

    let completed = 0;
    for (const offer of dueOffers || []) {
      const { error } = await supabaseClient.functions.invoke('process-pr-activity', {
        body: { offerId: offer.id, action: 'complete' },
      });
      if (!error) completed++;
    }

    console.log(`Completed ${completed} PR activities`);

    return new Response(
      JSON.stringify({ success: true, completed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
