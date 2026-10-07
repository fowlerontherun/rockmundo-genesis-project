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
  music_fan: 0.75,
  influencer: 0.6,
  critic: 0.4,
  industry_insider: 0.5,
  venue_owner: 0.45,
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
async function fetchAllPages(buildQuery: () => any, pageSize = 1000): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function getFollowProbability(fame: number, fans: number = 0): number {
  let prob = 0;
  if (fame >= 10000) prob = 0.7;
  else if (fame >= 5000) prob = 0.5;
  else if (fame >= 1000) prob = 0.35;
  else if (fame >= 500) prob = 0.25;
  else if (fame >= 100) prob = 0.18;
  else if (fame >= 50) prob = 0.12;
  else prob = 0.08;
  
  if (fans >= 10000) prob += 0.15;
  else if (fans >= 5000) prob += 0.1;
  else if (fans >= 1000) prob += 0.05;
  
  return Math.min(0.85, prob);
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
        account:twaater_accounts!twaater_bot_accounts_account_id_fkey(id, handle, display_name)
      `)
      .eq("is_active", true);

    if (botsError) throw botsError;

    console.log(`[bot-engagement] Found ${bots?.length || 0} active bots`);

    // Get recent player twaats (last 48 hours, not from bots)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const botAccountIds = bots?.map(b => b.account_id) || [];
    
    // Fetch twaats separately without embedding account
    const { data: recentTwaats, error: twaatsError } = await supabase
      .from("twaats")
      .select("id, body, account_id, created_at")
      .gte("created_at", twoDaysAgo)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .is("scheduled_for", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (twaatsError) throw twaatsError;

    // Filter out bot twaats
    const playerTwaats = recentTwaats?.filter(t => !botAccountIds.includes(t.account_id)) || [];
    console.log(`[bot-engagement] Found ${playerTwaats.length} recent player twaats`);

    // Get ALL player accounts for follows (uses owner_type and owner_id)
    const { data: allPlayerAccounts, error: accountsError } = await supabase
      .from("twaater_accounts")
      .select("id, owner_type, owner_id");
    if (accountsError) throw accountsError;

    // Filter out bot accounts
    const nonBotAccounts = allPlayerAccounts?.filter(a => !botAccountIds.includes(a.id)) || [];
    const accountById = new Map(nonBotAccounts.map((account: any) => [account.id, account]));
    const playerTwaatIds = playerTwaats.map((twaat: any) => twaat.id);
    const nonBotAccountIds = nonBotAccounts.map((account: any) => account.id);

    // Get fame data for all players
    const personaOwnerIds = nonBotAccounts.filter(a => a.owner_type === 'persona' && a.owner_id).map(a => a.owner_id);
    const bandOwnerIds = nonBotAccounts.filter(a => a.owner_type === 'band' && a.owner_id).map(a => a.owner_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, fame")
      .in("id", personaOwnerIds.length > 0 ? personaOwnerIds : ['none']);

    const { data: bands } = await supabase
      .from("bands")
      .select("id, fame, total_fans")
      .in("id", bandOwnerIds.length > 0 ? bandOwnerIds : ['none']);

    const fameByOwnerId = new Map(profiles?.map(p => [p.id, p.fame || 0]));
    const bandDataById = new Map(bands?.map(b => [b.id, { fame: b.fame || 0, fans: b.total_fans || 0 }]));

    // Preload existing bot activity once instead of issuing per-bot/per-twaat existence queries.
    // These sets can exceed PostgREST's per-response row cap, so page until the
    // final short page rather than silently dropping existing activity.
    const [existingReactions, existingReplies, existingFollows] = await Promise.all([
      playerTwaatIds.length > 0 && botAccountIds.length > 0
        ? fetchAllPages(() =>
            supabase
              .from("twaater_reactions")
              .select("twaat_id, account_id")
              .in("twaat_id", playerTwaatIds)
              .in("account_id", botAccountIds)
              .order("twaat_id")
              .order("account_id")
          )
        : Promise.resolve([]),
      playerTwaatIds.length > 0 && botAccountIds.length > 0
        ? fetchAllPages(() =>
            supabase
              .from("twaat_replies")
              .select("parent_twaat_id, account_id")
              .in("parent_twaat_id", playerTwaatIds)
              .in("account_id", botAccountIds)
              .order("parent_twaat_id")
              .order("account_id")
          )
        : Promise.resolve([]),
      nonBotAccountIds.length > 0 && botAccountIds.length > 0
        ? fetchAllPages(() =>
            supabase
              .from("twaater_follows")
              .select("follower_account_id, followed_account_id")
              .in("follower_account_id", botAccountIds)
              .in("followed_account_id", nonBotAccountIds)
              .order("follower_account_id")
              .order("followed_account_id")
          )
        : Promise.resolve([]),
    ]);

    const reactionKeys = new Set(
      existingReactions.map((row: any) => `${row.account_id}:${row.twaat_id}`),
    );
    const replyKeys = new Set(
      existingReplies.map((row: any) => `${row.account_id}:${row.parent_twaat_id}`),
    );
    const followKeys = new Set(
      existingFollows.map((row: any) => `${row.follower_account_id}:${row.followed_account_id}`),
    );
    const engagedBandOwnerIds = new Set<string>();

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
        const reactionKey = `${bot.account_id}:${twaat.id}`;
        const replyKey = `${bot.account_id}:${twaat.id}`;
        const targetAccount = accountById.get(twaat.account_id) as any;

        // Random chance to like
        if (!reactionKeys.has(reactionKey) && Math.random() < likeProbability) {
          const { error: likeError } = await supabase
            .from("twaater_reactions")
            .insert({
              twaat_id: twaat.id,
              account_id: bot.account_id,
              reaction_type: "like",
            });

          if (!likeError) {
            reactionKeys.add(reactionKey);
            likesCreated++;
            if (targetAccount?.owner_type === "band" && targetAccount.owner_id) {
              engagedBandOwnerIds.add(targetAccount.owner_id);
            }
          }
        }

        // Random chance to reply
        if (!replyKeys.has(replyKey) && Math.random() < replyProbability) {
          const replyBody = templates[Math.floor(Math.random() * templates.length)];
          
          const { error: replyError } = await supabase
            .from("twaat_replies")
            .insert({
              parent_twaat_id: twaat.id,
              account_id: bot.account_id,
              body: replyBody,
            });

          if (!replyError) {
            replyKeys.add(replyKey);
            repliesCreated++;
            if (targetAccount?.owner_type === "band" && targetAccount.owner_id) {
              engagedBandOwnerIds.add(targetAccount.owner_id);
            }
          }
        }
      }

      // IMPROVED: Follow logic for ALL player accounts based on fame/fans
      let followsThisBot = 0;
      const maxFollowsPerBot = Math.floor(Math.random() * 3) + 1;
      
      const shuffledAccounts = [...nonBotAccounts].sort(() => Math.random() - 0.5);
      
      for (const playerAccount of shuffledAccounts) {
        if (followsThisBot >= maxFollowsPerBot) break;
        if (playerAccount.id === bot.account_id) continue;

        const followKey = `${bot.account_id}:${playerAccount.id}`;
        if (followKeys.has(followKey)) continue;

        // Calculate fame and fans
        let fame = 0;
        let fans = 0;
        
        if (playerAccount.owner_type === 'persona' && playerAccount.owner_id) {
          fame = fameByOwnerId.get(playerAccount.owner_id) || 0;
        } else if (playerAccount.owner_type === 'band' && playerAccount.owner_id) {
          const bandData = bandDataById.get(playerAccount.owner_id);
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
            followKeys.add(followKey);
            followsCreated++;
            followsThisBot++;
            if (playerAccount.owner_type === "band" && playerAccount.owner_id) {
              engagedBandOwnerIds.add(playerAccount.owner_id);
            }
            console.log(`[bot-engagement] @${bot.account?.handle} followed account ${playerAccount.id} (fame: ${fame}, fans: ${fans})`);
          }
        }
      }
    }

    // === BOT ENGAGEMENT → BAND MORALE (v1.0.976) ===
    // High engagement (lots of likes/replies/follows) gives a small morale boost to band accounts
    const totalEngagement = repliesCreated + likesCreated + followsCreated;
    if (totalEngagement >= 5) {
      try {
        // Only bands that actually received a like, reply, or follow in this run get morale.
        for (const bandId of engagedBandOwnerIds) {
          const { data: bd } = await supabase.from('bands').select('morale').eq('id', bandId).single();
          if (bd) {
            const moraleBoost = totalEngagement >= 20 ? 3 : totalEngagement >= 10 ? 2 : 1;
            await supabase.from('bands').update({ morale: Math.min(100, ((bd as any).morale ?? 50) + moraleBoost) } as any).eq('id', bandId);
            console.log(`[bot-engagement] Social buzz: ${totalEngagement} engagements → morale +${moraleBoost} for band ${bandId}`);
          }
        }
      } catch (_e) { /* non-critical */ }
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
