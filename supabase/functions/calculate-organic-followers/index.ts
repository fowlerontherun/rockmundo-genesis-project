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

    console.log("[calculate-organic-followers] Starting organic follower calculation...");

    // Get active bot accounts
    const { data: bots, error: botsError } = await supabase
      .from("twaater_bot_accounts")
      .select("account_id, account:twaater_accounts(handle)")
      .eq("is_active", true);

    if (botsError) throw botsError;

    const botAccountIds = bots?.map(b => b.account_id) || [];
    
    if (botAccountIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active bots found", followersAdded: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all player accounts with their fame/fans data
    const { data: playerAccounts, error: accountsError } = await supabase
      .from("twaater_accounts")
      .select("id, owner_type, persona_id, band_id")
      .is("deleted_at", null)
      .not("id", "in", `(${botAccountIds.join(",")})`);

    if (accountsError) throw accountsError;

    console.log(`[calculate-organic-followers] Processing ${playerAccounts?.length || 0} player accounts`);

    // Get fame data
    const personaIds = playerAccounts?.filter(a => a.persona_id).map(a => a.persona_id) || [];
    const bandIds = playerAccounts?.filter(a => a.band_id).map(a => a.band_id) || [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fame")
      .in("id", personaIds.length > 0 ? personaIds : ['none']);

    const { data: bands } = await supabase
      .from("bands")
      .select("id, fame, total_fans")
      .in("id", bandIds.length > 0 ? bandIds : ['none']);

    const fameByPersonaId = new Map(profiles?.map(p => [p.id, p.fame || 0]));
    const bandDataById = new Map(bands?.map(b => [b.id, { fame: b.fame || 0, fans: b.total_fans || 0 }]));

    let totalFollowersAdded = 0;

    for (const account of playerAccounts || []) {
      // Calculate target followers based on fame and fans
      let fame = 0;
      let fans = 0;

      if (account.owner_type === 'persona' && account.persona_id) {
        fame = fameByPersonaId.get(account.persona_id) || 0;
      } else if (account.owner_type === 'band' && account.band_id) {
        const bandData = bandDataById.get(account.band_id);
        fame = bandData?.fame || 0;
        fans = bandData?.fans || 0;
      }

      // Target followers formula: fame / 15 + fans / 8 (more generous)
      const targetFollowers = Math.max(2, Math.floor(fame / 15 + fans / 8));

      // Get current bot followers
      const { data: currentFollows, error: followsError } = await supabase
        .from("twaater_follows")
        .select("follower_account_id")
        .eq("followed_account_id", account.id)
        .in("follower_account_id", botAccountIds);

      if (followsError) continue;

      const currentBotFollowers = currentFollows?.length || 0;
      const followersToAdd = Math.min(3, targetFollowers - currentBotFollowers); // Max 3 per run

      if (followersToAdd <= 0) continue;

      // Find bots not already following this account
      const currentFollowerIds = new Set(currentFollows?.map(f => f.follower_account_id) || []);
      const availableBots = bots?.filter(b => !currentFollowerIds.has(b.account_id)) || [];

      if (availableBots.length === 0) continue;

      // Shuffle and pick random bots
      const shuffledBots = [...availableBots].sort(() => Math.random() - 0.5);
      const botsToFollow = shuffledBots.slice(0, followersToAdd);

      for (const bot of botsToFollow) {
        const { error: insertError } = await supabase
          .from("twaater_follows")
          .insert({
            follower_account_id: bot.account_id,
            followed_account_id: account.id,
          });

        if (!insertError) {
          totalFollowersAdded++;

          // Create notification
          await supabase
            .from("twaater_notifications")
            .insert({
              account_id: account.id,
              type: "follow",
              actor_account_id: bot.account_id,
              message: `@${bot.account?.handle || 'someone'} started following you`,
            });

          console.log(`[calculate-organic-followers] Bot ${bot.account_id} now follows account ${account.id} (fame: ${fame}, fans: ${fans})`);
        }
      }
    }

    console.log(`[calculate-organic-followers] Completed. Added ${totalFollowersAdded} organic followers`);

    return new Response(
      JSON.stringify({
        success: true,
        followersAdded: totalFollowersAdded,
        accountsProcessed: playerAccounts?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-organic-followers] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
