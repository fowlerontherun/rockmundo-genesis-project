import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reply templates by bot type - expanded for variety
const REPLY_TEMPLATES = {
  critic: [
    "Interesting perspective on this track. The production choices are bold.",
    "I'd give this a solid 7/10. Room for growth but promising.",
    "The arrangement here is chef's kiss. Well done.",
    "Not my usual style but I can appreciate the craft.",
    "The dynamics in this are well thought out. Solid work.",
    "This has a unique texture to it. Keep pushing boundaries.",
  ],
  music_fan: [
    "OMG THIS IS SO GOOD 🔥🔥🔥",
    "Obsessed with this!! Been on repeat all day",
    "This hits different 💜",
    "Adding this to every playlist I have rn",
    "WHY IS THIS SO GOOD",
    "okay but this is actually perfect??",
    "needed this today 🎵✨",
    "the vibes are immaculate",
    "can't stop listening tbh",
  ],
  industry_insider: [
    "Smart move. The market is responding well to this sound.",
    "Keep pushing this direction. I see big things ahead.",
    "The streaming potential here is strong. Nice work.",
    "Solid release strategy. The timing is right.",
    "This is radio-ready. Well executed.",
  ],
  influencer: [
    "Just added this to my playlist! My followers need to hear this ✨",
    "Okay this is going viral on my story 🎧",
    "The vibes are immaculate. Sharing everywhere.",
    "featuring this in my next mix for sure 🔥",
    "my audience is gonna LOVE this",
  ],
  venue_owner: [
    "Would love to see this performed live at our venue!",
    "The crowd would go crazy for this. DM us about booking!",
    "Great energy! Perfect for our upcoming shows.",
    "This is the sound we look for. Let's talk!",
  ],
};

// INCREASED like probabilities
const LIKE_PROBABILITY: Record<string, number> = {
  music_fan: 0.75,     // Was 0.6
  influencer: 0.6,     // Was 0.4
  critic: 0.4,         // Was 0.2
  industry_insider: 0.5, // Was 0.3
  venue_owner: 0.45,   // Was 0.25
};

// INCREASED reply probabilities
const REPLY_PROBABILITY: Record<string, number> = {
  music_fan: 0.25,
  influencer: 0.2,
  critic: 0.15,
  industry_insider: 0.12,
  venue_owner: 0.1,
};

// MUCH HIGHER follow probability based on player fame
// New players should get followers quickly to feel engaged
function getFollowProbability(fame: number, fans: number = 0): number {
  // Base probability from fame
  let prob = 0;
  if (fame >= 10000) prob = 0.7;
  else if (fame >= 5000) prob = 0.5;
  else if (fame >= 1000) prob = 0.35;
  else if (fame >= 500) prob = 0.25;
  else if (fame >= 100) prob = 0.18;
  else if (fame >= 50) prob = 0.12;
  else prob = 0.08; // Even 0-fame accounts get some follows
  
  // Bonus from fans
  if (fans >= 10000) prob += 0.15;
  else if (fans >= 5000) prob += 0.1;
  else if (fans >= 1000) prob += 0.05;
  
  return Math.min(0.85, prob); // Cap at 85%
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

    // Get recent player twaats (last 48 hours, not from bots) - increased window
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const botAccountIds = bots?.map(b => b.account_id) || [];
    
    const { data: recentTwaats, error: twaatsError } = await supabase
      .from("twaats")
      .select(`
        id,
        body,
        account_id,
        created_at,
        account:twaater_accounts(id, handle, display_name, owner_type, persona_id, band_id)
      `)
      .gte("created_at", twoDaysAgo)
      .is("deleted_at", null)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(100);

    if (twaatsError) throw twaatsError;

    // Filter out bot twaats
    const playerTwaats = recentTwaats?.filter(t => !botAccountIds.includes(t.account_id)) || [];
    console.log(`[bot-engagement] Found ${playerTwaats.length} recent player twaats`);

    // Get ALL player accounts (not just those with recent twaats) for follows
    const { data: allPlayerAccounts } = await supabase
      .from("twaater_accounts")
      .select("id, persona_id, band_id, owner_type")
      .is("deleted_at", null)
      .not("id", "in", `(${botAccountIds.join(",")})`);

    // Get fame data for all players
    const personaIds = allPlayerAccounts?.filter(a => a.persona_id).map(a => a.persona_id) || [];
    const bandIds = allPlayerAccounts?.filter(a => a.band_id).map(a => a.band_id) || [];
    
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

    let repliesCreated = 0;
    let likesCreated = 0;
    let followsCreated = 0;

    for (const bot of bots || []) {
      const botType = bot.bot_type as keyof typeof REPLY_TEMPLATES;
      const templates = REPLY_TEMPLATES[botType] || REPLY_TEMPLATES.music_fan;
      const likeProbability = LIKE_PROBABILITY[botType] || 0.5;
      const replyProbability = REPLY_PROBABILITY[botType] || 0.15;

      // Process each player twaat for likes/replies
      for (const twaat of playerTwaats) {
        // Skip if bot already reacted to this twaat
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
            
            // Create notification for the player
            await supabase
              .from("twaater_notifications")
              .insert({
                account_id: twaat.account_id,
                type: "like",
                actor_account_id: bot.account_id,
                twaat_id: twaat.id,
                message: `@${bot.account?.handle} liked your twaat`,
              });
          }
        }

        // Check for existing reply
        const { data: existingReply } = await supabase
          .from("twaat_replies")
          .select("id")
          .eq("twaat_id", twaat.id)
          .eq("account_id", bot.account_id)
          .limit(1);

        // Random chance to reply
        if ((!existingReply || existingReply.length === 0) && Math.random() < replyProbability) {
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
            
            // Create notification for the player
            await supabase
              .from("twaater_notifications")
              .insert({
                account_id: twaat.account_id,
                type: "reply",
                actor_account_id: bot.account_id,
                twaat_id: twaat.id,
                message: `@${bot.account?.handle} replied to your twaat`,
              });
          }
        }
      }

      // IMPROVED: Follow logic for ALL player accounts based on fame/fans
      // Each bot tries to follow 1-3 accounts per run
      let followsThisBot = 0;
      const maxFollowsPerBot = Math.floor(Math.random() * 3) + 1;
      
      const shuffledAccounts = [...(allPlayerAccounts || [])].sort(() => Math.random() - 0.5);
      
      for (const playerAccount of shuffledAccounts) {
        if (followsThisBot >= maxFollowsPerBot) break;
        if (playerAccount.id === bot.account_id) continue;

        // Check if already following
        const { data: existingFollow } = await supabase
          .from("twaater_follows")
          .select("id")
          .eq("follower_account_id", bot.account_id)
          .eq("followed_account_id", playerAccount.id)
          .limit(1);

        if (existingFollow && existingFollow.length > 0) continue;

        // Calculate fame and fans
        let fame = 0;
        let fans = 0;
        
        if (playerAccount.owner_type === 'persona' && playerAccount.persona_id) {
          fame = fameByPersonaId.get(playerAccount.persona_id) || 0;
        } else if (playerAccount.owner_type === 'band' && playerAccount.band_id) {
          const bandData = bandDataById.get(playerAccount.band_id);
          fame = bandData?.fame || 0;
          fans = bandData?.fans || 0;
        }
        
        const followProb = getFollowProbability(fame, fans);

        if (Math.random() < followProb) {
          const { error: followError } = await supabase
            .from("twaater_follows")
            .insert({
              follower_account_id: bot.account_id,
              followed_account_id: playerAccount.id,
            });

          if (!followError) {
            followsCreated++;
            followsThisBot++;
            console.log(`[bot-engagement] @${bot.account?.handle} followed account ${playerAccount.id} (fame: ${fame}, fans: ${fans})`);

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
