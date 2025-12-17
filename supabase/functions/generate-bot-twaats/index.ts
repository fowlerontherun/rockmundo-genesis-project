import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates for different bot types
const BOT_TEMPLATES = {
  critic: {
    chart_comment: [
      "📊 Interesting movement on the charts today. {song} by {artist} is {trend}. Quality production here.",
      "🎵 Hot take: {song} deserves to be higher. {artist} delivered something special.",
      "📈 Chart analysis: {song} climbed {positions} spots this week. The hook is undeniable.",
      "🔍 Deep cut alert: Check out {song} before it blows up. {artist} is onto something.",
    ],
    gig_comment: [
      "🎤 Caught {artist} at {venue} last night. {rating}/10. The setlist was {setlist_opinion}.",
      "📝 Live review: {artist} brought the energy at {venue}. Crowd was {crowd_vibe}.",
      "🎸 Hot take from {venue}: {artist} is {performance_quality} live. Worth catching on tour.",
    ],
    general: [
      "🎵 What's everyone listening to this week? Drop your recommendations below.",
      "📊 Weekly hot take: The algorithm is sleeping on so many good tracks right now.",
      "🔊 Production tip: Pay attention to the low-end in today's top releases. It's getting interesting.",
    ],
  },
  venue_owner: {
    gig_promo: [
      "🎤 TONIGHT at {venue}: Doors at 8pm! Don't miss this one.",
      "🎪 This weekend's lineup is looking 🔥 See you at the front!",
      "🎸 Sold out show alert! {artist} brought the house down.",
    ],
    general: [
      "🍻 Happy hour starts at 6! Great tunes on the house system tonight.",
      "🎵 Looking for bands to book next month. DMs open for submissions!",
      "📅 New show announcements coming this week. Stay tuned!",
    ],
  },
  industry_insider: {
    chart_comment: [
      "📈 Market analysis: {song} streaming numbers are impressive. {artist} is building momentum.",
      "💼 Industry insight: Watch {artist} this quarter. Label support is ramping up.",
      "🎯 A&R tip: {genre} is having a moment. Keep an eye on emerging artists.",
    ],
    gig_comment: [
      "🎤 Just saw {artist} showcase. Booking inquiries incoming for sure.",
      "💼 Live music market is heating up. {venue} attendance up 20% this month.",
    ],
    general: [
      "💡 Producer tip: Layer your synths with acoustic textures. Game changer.",
      "📊 Streaming data shows {genre} engagement up 15% this month.",
      "🎛️ Mixing tip of the day: Less is more with the high-end. Trust your monitors.",
      "🚐 Tour planning 101: Always have a backup van key. Trust me on this one.",
    ],
  },
  music_fan: {
    chart_comment: [
      "OMG {song} is so good!!! {artist} never misses 🔥🔥🔥",
      "Who else has {song} on repeat?? Just me?? 😍",
      "Not me crying to {song} at 3am... again... 😭💕",
      "{artist} really said TAKE MY MONEY with this release",
    ],
    gig_comment: [
      "JUST SAW {artist} LIVE AND I'M NOT OKAY 😭🎤",
      "Best night ever at {venue}!! My voice is gone but worth it",
      "The way {artist} performed {song} live... I'll never recover",
    ],
    general: [
      "What concerts are y'all going to this month?? Need plans",
      "Current mood: making playlists I'll never share with anyone",
      "POV: You find a song from 2019 that still hits different 🥲",
    ],
  },
  influencer: {
    chart_comment: [
      "🎧 New playlist drop! {song} by {artist} is the vibe. Link in bio.",
      "✨ Just added {song} to my driving playlist. {artist} understood the assignment.",
      "🔥 This week's must-listen: {song}. Your ears will thank me.",
    ],
    general: [
      "🎧 What genre should I dive into next? Comment below!",
      "✨ Just hit 50k playlist followers! Thank you for trusting my taste 💜",
      "🎵 Behind the scenes of playlist curation: It's harder than it looks!",
    ],
  },
};

// Generate contextual content based on game data
function generateTwaat(
  botType: string,
  personality: string[],
  gameData: {
    chartSongs?: any[];
    recentGigs?: any[];
    trending?: any[];
  }
): { body: string; hashtags: string[]; linkedType?: string; linkedId?: string } {
  const templates = BOT_TEMPLATES[botType as keyof typeof BOT_TEMPLATES] || BOT_TEMPLATES.music_fan;
  const hashtags: string[] = [];
  
  let template: string;
  let linkedType: string | undefined;
  let linkedId: string | undefined;
  
  // Decide what type of content to generate based on available data
  const rand = Math.random();
  
  if (gameData.chartSongs?.length && rand < 0.4 && templates.chart_comment) {
    // Comment on chart songs
    const song = gameData.chartSongs[Math.floor(Math.random() * gameData.chartSongs.length)];
    const templateList = templates.chart_comment;
    template = templateList[Math.floor(Math.random() * templateList.length)];
    
    const trends = ["climbing", "holding steady", "making waves", "picking up steam"];
    
    template = template
      .replace("{song}", song.title || "this track")
      .replace("{artist}", song.artist_name || song.band_name || "this artist")
      .replace("{trend}", trends[Math.floor(Math.random() * trends.length)])
      .replace("{positions}", String(Math.floor(Math.random() * 10) + 1))
      .replace("{genre}", song.genre || "indie");
    
    linkedType = "single";
    linkedId = song.id;
    hashtags.push("#NowPlaying", "#MusicCharts");
    
  } else if (gameData.recentGigs?.length && rand < 0.6 && templates.gig_comment) {
    // Comment on gigs
    const gig = gameData.recentGigs[Math.floor(Math.random() * gameData.recentGigs.length)];
    const templateList = templates.gig_comment;
    template = templateList[Math.floor(Math.random() * templateList.length)];
    
    const setlistOpinions = ["fire", "perfectly curated", "unexpected but amazing", "classic"];
    const crowdVibes = ["electric", "incredible", "sold out energy", "singing every word"];
    const qualities = ["incredible", "next level", "a must-see", "absolutely phenomenal"];
    
    template = template
      .replace("{artist}", gig.band_name || "the band")
      .replace("{venue}", gig.venue_name || "the venue")
      .replace("{rating}", String(Math.floor(Math.random() * 3) + 8))
      .replace("{setlist_opinion}", setlistOpinions[Math.floor(Math.random() * setlistOpinions.length)])
      .replace("{crowd_vibe}", crowdVibes[Math.floor(Math.random() * crowdVibes.length)])
      .replace("{performance_quality}", qualities[Math.floor(Math.random() * qualities.length)])
      .replace("{song}", gig.song_title || "their hit");
    
    linkedType = "gig";
    linkedId = gig.id;
    hashtags.push("#LiveMusic", "#Concert");
    
  } else {
    // General content
    const templateList = templates.general || ["🎵 Great day for music!"];
    template = templateList[Math.floor(Math.random() * templateList.length)];
    
    if (template.includes("{genre}")) {
      const genres = ["indie", "rock", "electronic", "hip-hop", "pop", "R&B"];
      template = template.replace("{genre}", genres[Math.floor(Math.random() * genres.length)]);
    }
  }
  
  // Add personality-based hashtags
  if (personality.includes("analytical")) hashtags.push("#MusicAnalysis");
  if (personality.includes("underground")) hashtags.push("#IndieMusic");
  if (personality.includes("trendy")) hashtags.push("#Trending");
  if (personality.includes("nostalgic")) hashtags.push("#Throwback");
  
  return { body: template, hashtags, linkedType, linkedId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[generate-bot-twaats] Starting bot twaat generation...");

    // Get active bot accounts
    const { data: bots, error: botsError } = await supabase
      .from("twaater_bot_accounts")
      .select(`
        *,
        account:twaater_accounts(*)
      `)
      .eq("is_active", true);

    if (botsError) {
      console.error("[generate-bot-twaats] Error fetching bots:", botsError);
      throw botsError;
    }

    console.log(`[generate-bot-twaats] Found ${bots?.length || 0} active bots`);

    // Fetch game data for contextual content
    const { data: chartSongs } = await supabase
      .from("chart_entries")
      .select(`
        *,
        song:songs(id, title, genre, band:bands(name))
      `)
      .order("rank", { ascending: true })
      .limit(20);

    const { data: recentGigs } = await supabase
      .from("gigs")
      .select(`
        id,
        band:bands(name),
        venue:venues(name)
      `)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10);

    const gameData = {
      chartSongs: chartSongs?.map(c => ({
        id: c.song?.id,
        title: c.song?.title,
        band_name: c.song?.band?.name,
        genre: c.song?.genre,
        rank: c.rank,
      })) || [],
      recentGigs: recentGigs?.map(g => ({
        id: g.id,
        band_name: g.band?.name,
        venue_name: g.venue?.name,
      })) || [],
    };

    let twaatsCreated = 0;

    // Generate twaats for eligible bots
    for (const bot of bots || []) {
      // Check posting frequency
      const frequencyHours = bot.posting_frequency === "high" ? 2 : bot.posting_frequency === "medium" ? 4 : 8;
      const lastPosted = bot.last_posted_at ? new Date(bot.last_posted_at) : null;
      const hoursSinceLastPost = lastPosted 
        ? (Date.now() - lastPosted.getTime()) / (1000 * 60 * 60) 
        : frequencyHours + 1;

      // Add randomness to posting frequency
      const shouldPost = hoursSinceLastPost >= frequencyHours && Math.random() > 0.3;

      if (!shouldPost) {
        continue;
      }

      const personality = Array.isArray(bot.personality_traits) ? bot.personality_traits : [];
      const twaatContent = generateTwaat(bot.bot_type, personality, gameData);

      // Create the twaat
      const { data: newTwaat, error: twaatError } = await supabase
        .from("twaats")
        .insert({
          account_id: bot.account_id,
          body: twaatContent.body + (twaatContent.hashtags.length ? "\n\n" + twaatContent.hashtags.join(" ") : ""),
          linked_type: twaatContent.linkedType,
          linked_id: twaatContent.linkedId,
          visibility: "public",
        })
        .select()
        .single();

      if (twaatError) {
        console.error(`[generate-bot-twaats] Error creating twaat for ${bot.account?.handle}:`, twaatError);
        continue;
      }

      // Update last_posted_at
      await supabase
        .from("twaater_bot_accounts")
        .update({ last_posted_at: new Date().toISOString() })
        .eq("id", bot.id);

      console.log(`[generate-bot-twaats] Created twaat for @${bot.account?.handle}: "${twaatContent.body.substring(0, 50)}..."`);
      twaatsCreated++;
    }

    console.log(`[generate-bot-twaats] Completed. Created ${twaatsCreated} twaats.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        twaatsCreated,
        message: `Generated ${twaatsCreated} bot twaats`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-bot-twaats] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
