import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates for different bot types - expanded for more variety
const BOT_TEMPLATES = {
  critic: {
    chart_comment: [
      "📊 Interesting movement on the charts today. {song} by {artist} is {trend}. Quality production here.",
      "🎵 Hot take: {song} deserves to be higher. {artist} delivered something special.",
      "📈 Chart analysis: {song} climbed {positions} spots this week. The hook is undeniable.",
      "🔍 Deep cut alert: Check out {song} before it blows up. {artist} is onto something.",
      "⭐ Weekly spotlight: {song} showcases exactly why {artist} is one to watch.",
      "🎼 The arrangement on {song} is textbook excellence. {artist} knows their craft.",
    ],
    gig_comment: [
      "🎤 Caught {artist} at {venue} last night. {rating}/10. The setlist was {setlist_opinion}.",
      "📝 Live review: {artist} brought the energy at {venue}. Crowd was {crowd_vibe}.",
      "🎸 Hot take from {venue}: {artist} is {performance_quality} live. Worth catching on tour.",
      "🎭 Stage presence matters, and {artist} absolutely owned {venue} last night.",
    ],
    general: [
      "🎵 What's everyone listening to this week? Drop your recommendations below.",
      "📊 Weekly hot take: The algorithm is sleeping on so many good tracks right now.",
      "🔊 Production tip: Pay attention to the low-end in today's top releases. It's getting interesting.",
      "📝 Just finished a 3-hour listening session. My ears are grateful and my playlist is stacked.",
      "🎧 The current state of {genre} is fascinating. Discuss.",
      "💿 Album vs singles debate: Quality over quantity, always.",
      "🎹 Musicians who understand music theory hit different. You can hear it.",
    ],
  },
  venue_owner: {
    gig_promo: [
      "🎤 TONIGHT at {venue}: Doors at 8pm! Don't miss this one.",
      "🎪 This weekend's lineup is looking 🔥 See you at the front!",
      "🎸 Sold out show alert! {artist} brought the house down.",
      "📅 Mark your calendars - big announcement coming for next month!",
    ],
    general: [
      "🍻 Happy hour starts at 6! Great tunes on the house system tonight.",
      "🎵 Looking for bands to book next month. DMs open for submissions!",
      "📅 New show announcements coming this week. Stay tuned!",
      "🎤 Open mic night tomorrow! Come show us what you've got.",
      "🔊 Just upgraded our sound system. Come hear the difference!",
      "🎸 Supporting local music is what we do. Tag your favorite local acts!",
      "✨ The energy in this venue on a Saturday night is unmatched.",
      "🎪 Festival season prep is in full swing. Exciting times ahead!",
    ],
  },
  industry_insider: {
    chart_comment: [
      "📈 Market analysis: {song} streaming numbers are impressive. {artist} is building momentum.",
      "💼 Industry insight: Watch {artist} this quarter. Label support is ramping up.",
      "🎯 A&R tip: {genre} is having a moment. Keep an eye on emerging artists.",
      "📊 The data doesn't lie - {song} is about to break through.",
    ],
    gig_comment: [
      "🎤 Just saw {artist} showcase. Booking inquiries incoming for sure.",
      "💼 Live music market is heating up. {venue} attendance up 20% this month.",
      "📈 Touring is back and stronger than ever. The numbers are wild.",
    ],
    general: [
      "💡 Producer tip: Layer your synths with acoustic textures. Game changer.",
      "📊 Streaming data shows {genre} engagement up 15% this month.",
      "🎛️ Mixing tip of the day: Less is more with the high-end. Trust your monitors.",
      "🚐 Tour planning 101: Always have a backup van key. Trust me on this one.",
      "💼 The industry is changing fast. Adapt or get left behind.",
      "🎯 Talent is everywhere. Opportunity? That's the hard part.",
      "📝 Contract tip: Always read the fine print. ALWAYS.",
      "🎵 The next big sound is already out there. You just haven't heard it yet.",
      "💰 Streaming royalties explained: It's complicated, but knowledge is power.",
    ],
  },
  music_fan: {
    chart_comment: [
      "OMG {song} is so good!!! {artist} never misses 🔥🔥🔥",
      "Who else has {song} on repeat?? Just me?? 😍",
      "Not me crying to {song} at 3am... again... 😭💕",
      "{artist} really said TAKE MY MONEY with this release",
      "I've played {song} like 47 times today and I'm not stopping",
      "The way {song} makes me feel things 😭🎵",
    ],
    gig_comment: [
      "JUST SAW {artist} LIVE AND I'M NOT OKAY 😭🎤",
      "Best night ever at {venue}!! My voice is gone but worth it",
      "The way {artist} performed {song} live... I'll never recover",
      "Concert withdrawal is real and I'm suffering 💔🎸",
    ],
    general: [
      "What concerts are y'all going to this month?? Need plans",
      "Current mood: making playlists I'll never share with anyone",
      "POV: You find a song from 2019 that still hits different 🥲",
      "Why do the best songs always come out when I'm emotional 😭",
      "Music taste = personality. Prove me wrong.",
      "The serotonin hit when your favorite artist drops new music 🎵✨",
      "Arguing about {genre} at 2am > sleep",
      "Tell me your guilty pleasure song. I promise no judgment. 🙃",
      "New music Friday is basically a holiday at this point",
      "The algorithm finally understood me. Scary but also... thank you?",
    ],
  },
  influencer: {
    chart_comment: [
      "🎧 New playlist drop! {song} by {artist} is the vibe. Link in bio.",
      "✨ Just added {song} to my driving playlist. {artist} understood the assignment.",
      "🔥 This week's must-listen: {song}. Your ears will thank me.",
      "Obsessed with {song} right now. {artist} is having a MOMENT.",
    ],
    general: [
      "🎧 What genre should I dive into next? Comment below!",
      "✨ Just hit 50k playlist followers! Thank you for trusting my taste 💜",
      "🎵 Behind the scenes of playlist curation: It's harder than it looks!",
      "Drop your spotify wrapped predictions 👇",
      "Morning playlist vs night playlist energy - they're NOT the same",
      "POV: You're the friend everyone asks for music recs 🎵",
      "The perfect playlist doesn't exi— *shares playlist*",
      "Music discovery is my superpower 🦸‍♀️✨",
      "About to do a live listening party for new releases. Who's in?",
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
  
  if (gameData.chartSongs?.length && rand < 0.35 && templates.chart_comment) {
    // Comment on chart songs
    const song = gameData.chartSongs[Math.floor(Math.random() * gameData.chartSongs.length)];
    const templateList = templates.chart_comment;
    template = templateList[Math.floor(Math.random() * templateList.length)];
    
    const trends = ["climbing", "holding steady", "making waves", "picking up steam", "gaining traction"];
    
    template = template
      .replace("{song}", song.title || "this track")
      .replace("{artist}", song.artist_name || song.band_name || "this artist")
      .replace("{trend}", trends[Math.floor(Math.random() * trends.length)])
      .replace("{positions}", String(Math.floor(Math.random() * 10) + 1))
      .replace("{genre}", song.genre || "indie");
    
    linkedType = "single";
    linkedId = song.id;
    hashtags.push("#NowPlaying", "#MusicCharts");
    
  } else if (gameData.recentGigs?.length && rand < 0.5 && templates.gig_comment) {
    // Comment on gigs
    const gig = gameData.recentGigs[Math.floor(Math.random() * gameData.recentGigs.length)];
    const templateList = templates.gig_comment;
    template = templateList[Math.floor(Math.random() * templateList.length)];
    
    const setlistOpinions = ["fire", "perfectly curated", "unexpected but amazing", "classic", "bold choices"];
    const crowdVibes = ["electric", "incredible", "sold out energy", "singing every word", "absolutely wild"];
    const qualities = ["incredible", "next level", "a must-see", "absolutely phenomenal", "unforgettable"];
    
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
      const genres = ["indie", "rock", "electronic", "hip-hop", "pop", "R&B", "jazz", "metal"];
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

    // Check recent twaat count - if feed is empty, force more posts
    const { data: recentCount } = await supabase.rpc('get_recent_twaat_count');
    const feedIsEmpty = (recentCount || 0) < 5;
    
    if (feedIsEmpty) {
      console.log("[generate-bot-twaats] Feed is empty/low, forcing bot posts...");
    }

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
    const now = Date.now();

    // Generate twaats for eligible bots
    for (const bot of bots || []) {
      // IMPROVED: More aggressive posting frequency
      // High = every 30 mins, Medium = every hour, Low = every 2 hours
      const frequencyMinutes = bot.posting_frequency === "high" ? 30 : bot.posting_frequency === "medium" ? 60 : 120;
      const lastPosted = bot.last_posted_at ? new Date(bot.last_posted_at) : null;
      const minutesSinceLastPost = lastPosted 
        ? (now - lastPosted.getTime()) / (1000 * 60) 
        : frequencyMinutes + 1;

      // Force posting if feed is empty OR if enough time has passed
      // Reduced randomness factor to ensure more consistent posting
      const shouldPost = feedIsEmpty || (minutesSinceLastPost >= frequencyMinutes && Math.random() > 0.2);

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

      // Create initial metrics for the twaat
      await supabase
        .from("twaat_metrics")
        .insert({
          twaat_id: newTwaat.id,
          views: Math.floor(Math.random() * 100) + 10,
          likes: Math.floor(Math.random() * 20),
          replies: Math.floor(Math.random() * 5),
          retwaats: Math.floor(Math.random() * 5),
          engagement_rate: Math.random() * 0.1,
        });

      // Update last_posted_at
      await supabase
        .from("twaater_bot_accounts")
        .update({ last_posted_at: new Date().toISOString() })
        .eq("id", bot.id);

      console.log(`[generate-bot-twaats] Created twaat for @${bot.account?.handle}: "${twaatContent.body.substring(0, 50)}..."`);
      twaatsCreated++;
    }

    // GUARANTEE MINIMUM: If we still have very few twaats, create more
    if (twaatsCreated < 3 && bots && bots.length > 0) {
      console.log("[generate-bot-twaats] Forcing additional twaats to meet minimum...");
      
      // Pick random bots to post
      const shuffledBots = [...bots].sort(() => Math.random() - 0.5);
      const botsToForce = shuffledBots.slice(0, Math.min(5, shuffledBots.length));
      
      for (const bot of botsToForce) {
        const personality = Array.isArray(bot.personality_traits) ? bot.personality_traits : [];
        const twaatContent = generateTwaat(bot.bot_type, personality, gameData);

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

        if (!twaatError && newTwaat) {
          await supabase
            .from("twaat_metrics")
            .insert({
              twaat_id: newTwaat.id,
              views: Math.floor(Math.random() * 100) + 10,
              likes: Math.floor(Math.random() * 20),
              replies: Math.floor(Math.random() * 5),
              retwaats: Math.floor(Math.random() * 5),
              engagement_rate: Math.random() * 0.1,
            });

          await supabase
            .from("twaater_bot_accounts")
            .update({ last_posted_at: new Date().toISOString() })
            .eq("id", bot.id);

          twaatsCreated++;
          console.log(`[generate-bot-twaats] Forced twaat for @${bot.account?.handle}`);
        }
      }
    }

    console.log(`[generate-bot-twaats] Completed. Created ${twaatsCreated} twaats.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        twaatsCreated,
        feedWasEmpty: feedIsEmpty,
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
