import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reply templates by bot type
const REPLY_TEMPLATES = {
  critic: [
    "Interesting perspective on this track. The production choices are bold.",
    "I'd give this a solid 7/10. Room for growth but promising.",
    "The arrangement here is chef's kiss. Well done.",
    "Not my usual style but I can appreciate the craft.",
  ],
  music_fan: [
    "OMG THIS IS SO GOOD 🔥🔥🔥",
    "Obsessed with this!! Been on repeat all day",
    "This hits different 💜",
    "Adding this to every playlist I have rn",
    "WHY IS THIS SO GOOD",
  ],
  industry_insider: [
    "Smart move. The market is responding well to this sound.",
    "Keep pushing this direction. I see big things ahead.",
    "The streaming potential here is strong. Nice work.",
  ],
  influencer: [
    "Just added this to my playlist! My followers need to hear this ✨",
    "Okay this is going viral on my story 🎧",
    "The vibes are immaculate. Sharing everywhere.",
  ],
  venue_owner: [
    "Would love to see this performed live at our venue!",
    "The crowd would go crazy for this. DM us about booking!",
    "Great energy! Perfect for our upcoming shows.",
  ],
};

// Like probability by bot type
const LIKE_PROBABILITY: Record<string, number> = {
  music_fan: 0.6,
  influencer: 0.4,
  critic: 0.2,
  industry_insider: 0.3,
  venue_owner: 0.25,
};

// Follow probability based on player fame
function getFollowProbability(fame: number): number {
  if (fame >= 10000) return 0.5;
  if (fame >= 5000) return 0.3;
  if (fame >= 1000) return 0.15;
  if (fame >= 500) return 0.08;
  if (fame >= 100) return 0.04;
  return 0.02;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[bot-engagement] Starting bot engagement processing...");

    // Get active bot accounts
    const { data: bots, error: botsError } = await supabase
      .from("twaater_bot_accounts")
      .select(`
        *,
        account:twaater_accounts(id, handle, display_name)
      `)
      .eq("is_active", true);

    if (botsError) throw botsError;

    console.log(`[bot-engagement] Found ${bots?.length || 0} active bots`);

    // Get recent player twaats (last 24 hours, not from bots)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const botAccountIds = bots?.map(b => b.account_id) || [];
    
    const { data: recentTwaats, error: twaatsError } = await supabase
      .from("twaats")
      .select(`
        id,
        body,
        account_id,
        created_at,
        account:twaater_accounts(id, handle, display_name, owner_type, persona_id)
      `)
      .gte("created_at", oneDayAgo)
      .is("deleted_at", null)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(50);

    if (twaatsError) throw twaatsError;

    // Filter out bot twaats
    const playerTwaats = recentTwaats?.filter(t => !botAccountIds.includes(t.account_id)) || [];
    console.log(`[bot-engagement] Found ${playerTwaats.length} recent player twaats`);

    // Get player accounts with their fame
    const playerAccountIds = [...new Set(playerTwaats.map(t => t.account_id))];
    const { data: playerAccounts } = await supabase
      .from("twaater_accounts")
      .select("id, persona_id")
      .in("id", playerAccountIds);

    const personaIds = playerAccounts?.map(a => a.persona_id).filter(Boolean) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fame")
      .in("id", personaIds);

    const fameByPersonaId = new Map(profiles?.map(p => [p.id, p.fame || 0]));
    const personaByAccountId = new Map(playerAccounts?.map(a => [a.id, a.persona_id]));

    let repliesCreated = 0;
    let likesCreated = 0;
    let followsCreated = 0;

    for (const bot of bots || []) {
      const botType = bot.bot_type as keyof typeof REPLY_TEMPLATES;
      const templates = REPLY_TEMPLATES[botType] || REPLY_TEMPLATES.music_fan;
      const likeProbability = LIKE_PROBABILITY[botType] || 0.3;

      // Process each player twaat
      for (const twaat of playerTwaats) {
        // Skip if bot already interacted with this twaat
        const { data: existingReply } = await supabase
          .from("twaat_replies")
          .select("id")
          .eq("twaat_id", twaat.id)
          .eq("account_id", bot.account_id)
          .limit(1);

        if (existingReply && existingReply.length > 0) continue;

        // Check for existing reaction
        const { data: existingReaction } = await supabase
          .from("twaat_reactions")
          .select("id")
          .eq("twaat_id", twaat.id)
          .eq("account_id", bot.account_id)
          .limit(1);

        // Random chance to like
        if ((!existingReaction || existingReaction.length === 0) && Math.random() < likeProbability) {
          const { error: likeError } = await supabase
            .from("twaat_reactions")
            .insert({
              twaat_id: twaat.id,
              account_id: bot.account_id,
              reaction_type: "like",
            });

          if (!likeError) {
            likesCreated++;
            console.log(`[bot-engagement] @${bot.account?.handle} liked twaat ${twaat.id}`);
          }
        }

        // Random chance to reply (lower probability)
        if (Math.random() < 0.1) {
          const replyBody = templates[Math.floor(Math.random() * templates.length)];
          
          const { error: replyError } = await supabase
            .from("twaat_replies")
            .insert({
              twaat_id: twaat.id,
              account_id: bot.account_id,
              body: replyBody,
            });

          if (!replyError) {
            repliesCreated++;
            console.log(`[bot-engagement] @${bot.account?.handle} replied to twaat ${twaat.id}`);
          }
        }
      }

      // Follow logic based on player fame
      for (const playerAccount of playerAccounts || []) {
        if (playerAccount.id === bot.account_id) continue;

        // Check if already following
        const { data: existingFollow } = await supabase
          .from("twaater_follows")
          .select("id")
          .eq("follower_account_id", bot.account_id)
          .eq("followed_account_id", playerAccount.id)
          .limit(1);

        if (existingFollow && existingFollow.length > 0) continue;

        const personaId = personaByAccountId.get(playerAccount.id);
        const fame = personaId ? fameByPersonaId.get(personaId) || 0 : 0;
        const followProb = getFollowProbability(fame);

        if (Math.random() < followProb) {
          const { error: followError } = await supabase
            .from("twaater_follows")
            .insert({
              follower_account_id: bot.account_id,
              followed_account_id: playerAccount.id,
            });

          if (!followError) {
            followsCreated++;
            console.log(`[bot-engagement] @${bot.account?.handle} followed account ${playerAccount.id} (fame: ${fame})`);

            // Create notification for the player
            await supabase
              .from("twaater_notifications")
              .insert({
                account_id: playerAccount.id,
                type: "follow",
                actor_account_id: bot.account_id,
                message: `@${bot.account?.handle} started following you`,
              });
          }
        }
      }
    }

    console.log(`[bot-engagement] Completed. Replies: ${repliesCreated}, Likes: ${likesCreated}, Follows: ${followsCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        repliesCreated,
        likesCreated,
        followsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bot-engagement] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
