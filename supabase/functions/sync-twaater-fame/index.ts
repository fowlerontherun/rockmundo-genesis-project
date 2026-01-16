import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[sync-twaater-fame] Starting fame score sync...");

    // Get all twaater accounts (uses owner_type and owner_id)
    const { data: accounts, error: accountsError } = await supabase
      .from("twaater_accounts")
      .select("id, owner_type, owner_id, fame_score");

    if (accountsError) {
      throw accountsError;
    }

    console.log(`[sync-twaater-fame] Found ${accounts?.length || 0} accounts to sync`);

    let personaUpdates = 0;
    let bandUpdates = 0;

    // Get all profiles for persona accounts
    const personaAccounts = accounts?.filter(a => a.owner_type === 'persona' && a.owner_id) || [];
    if (personaAccounts.length > 0) {
      const ownerIds = personaAccounts.map(a => a.owner_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, fame")
        .in("id", ownerIds);

      const fameByOwnerId = new Map(profiles?.map(p => [p.id, p.fame || 0]));

      // Update each persona account
      for (const account of personaAccounts) {
        const newFame = fameByOwnerId.get(account.owner_id) || 0;
        if (newFame !== account.fame_score) {
          const { error: updateError } = await supabase
            .from("twaater_accounts")
            .update({ fame_score: newFame, updated_at: new Date().toISOString() })
            .eq("id", account.id);

          if (!updateError) {
            personaUpdates++;
          }
        }
      }
    }

    // Get all bands for band accounts
    const bandAccounts = accounts?.filter(a => a.owner_type === 'band' && a.owner_id) || [];
    if (bandAccounts.length > 0) {
      const ownerIds = bandAccounts.map(a => a.owner_id);
      const { data: bands } = await supabase
        .from("bands")
        .select("id, fame")
        .in("id", ownerIds);

      const fameByOwnerId = new Map(bands?.map(b => [b.id, b.fame || 0]));

      // Update each band account
      for (const account of bandAccounts) {
        const newFame = fameByOwnerId.get(account.owner_id) || 0;
        if (newFame !== account.fame_score) {
          const { error: updateError } = await supabase
            .from("twaater_accounts")
            .update({ fame_score: newFame, updated_at: new Date().toISOString() })
            .eq("id", account.id);

          if (!updateError) {
            bandUpdates++;
          }
        }
      }
    }

    console.log(`[sync-twaater-fame] Completed. Persona updates: ${personaUpdates}, Band updates: ${bandUpdates}`);

    return new Response(
      JSON.stringify({
        success: true,
        personaUpdates,
        bandUpdates,
        totalAccounts: accounts?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-twaater-fame] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
