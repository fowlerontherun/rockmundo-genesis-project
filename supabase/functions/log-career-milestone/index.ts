import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MilestoneLogRequest {
  profile_id: string;
  band_id?: string | null;
  milestone_type: string;
  title: string;
  content?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  occurred_at?: string;
}

// Milestone types and their auto-generated content templates
const MILESTONE_TEMPLATES: Record<string, { category: string; contentTemplate?: (meta: Record<string, unknown>) => string }> = {
  // Career Firsts
  first_gig_completed: {
    category: "performance",
    contentTemplate: (meta) => `Performed at ${meta.venue || "a venue"} to ${meta.attendance || 0} fans. Rating: ${meta.rating || "N/A"}`,
  },
  first_song_written: {
    category: "music",
    contentTemplate: (meta) => `Wrote "${meta.song_title || "a song"}" - the first step in your songwriting journey.`,
  },
  first_song_recorded: {
    category: "music",
    contentTemplate: (meta) => `Recorded "${meta.song_title || "a song"}" at ${meta.studio || "the studio"}.`,
  },
  first_release_published: {
    category: "career",
    contentTemplate: (meta) => `Released "${meta.release_title || "your first release"}" to the world.`,
  },
  first_chart_entry: {
    category: "chart",
    contentTemplate: (meta) => `"${meta.song_title || "A song"}" entered the charts at #${meta.position || "?"}!`,
  },
  first_number_one: {
    category: "chart",
    contentTemplate: (meta) => `"${meta.song_title || "A song"}" hit #1 on the charts!`,
  },
  first_tour_completed: {
    category: "performance",
    contentTemplate: (meta) => `Completed your first tour with ${meta.gig_count || 0} shows.`,
  },
  first_music_video: {
    category: "music",
    contentTemplate: (meta) => `Released your first music video for "${meta.song_title || "a song"}".`,
  },
  first_radio_play: {
    category: "career",
    contentTemplate: (meta) => `"${meta.song_title || "A song"}" got its first radio play on ${meta.station || "a station"}!`,
  },

  // Fan Milestones
  fans_100: { category: "fan", contentTemplate: () => "Reached 100 fans! Your music is starting to spread." },
  fans_1k: { category: "fan", contentTemplate: () => "Reached 1,000 fans! You're building a real following." },
  fans_10k: { category: "fan", contentTemplate: () => "Reached 10,000 fans! Your fanbase is growing strong." },
  fans_100k: { category: "fan", contentTemplate: () => "Reached 100,000 fans! You're becoming a household name." },
  fans_1m: { category: "fan", contentTemplate: () => "Reached 1 million fans! You're a superstar!" },

  // Fame Milestones
  fame_1k: { category: "career", contentTemplate: () => "Reached 1,000 fame points. You're getting noticed." },
  fame_10k: { category: "career", contentTemplate: () => "Reached 10,000 fame points. Your reputation precedes you." },
  fame_50k: { category: "career", contentTemplate: () => "Reached 50,000 fame points. You're a rising star!" },
  fame_100k: { category: "career", contentTemplate: () => "Reached 100,000 fame points. You're legendary!" },

  // Chart Peaks
  chart_top_50: { category: "chart", contentTemplate: (meta) => `"${meta.song_title || "A song"}" reached the Top 50!` },
  chart_top_10: { category: "chart", contentTemplate: (meta) => `"${meta.song_title || "A song"}" reached the Top 10!` },
  chart_top_1: { category: "chart", contentTemplate: (meta) => `"${meta.song_title || "A song"}" hit #1!` },

  // Earnings Milestones
  earned_10k: { category: "career", contentTemplate: () => "Earned $10,000 total. The grind is paying off." },
  earned_100k: { category: "career", contentTemplate: () => "Earned $100,000 total. You're making it!" },
  earned_1m: { category: "career", contentTemplate: () => "Earned $1,000,000 total. You're a millionaire rockstar!" },

  // Band Milestones
  band_formed: { category: "band", contentTemplate: (meta) => `Formed "${meta.band_name || "a new band"}" with your bandmates.` },
  band_member_joined: { category: "band", contentTemplate: (meta) => `${meta.member_name || "A new member"} joined the band.` },
  band_member_left: { category: "band", contentTemplate: (meta) => `${meta.member_name || "A member"} left the band.` },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: MilestoneLogRequest = await req.json();
    const {
      profile_id,
      band_id,
      milestone_type,
      title,
      content,
      category,
      metadata = {},
      related_entity_type,
      related_entity_id,
      occurred_at,
    } = body;

    if (!profile_id || !milestone_type || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: profile_id, milestone_type, title" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`[log-career-milestone] Processing milestone: ${milestone_type} for profile ${profile_id}`);

    // Check if this milestone has already been achieved
    const { data: existingMilestone, error: checkError } = await supabaseClient
      .from("player_milestone_tracking")
      .select("id")
      .eq("profile_id", profile_id)
      .eq("milestone_type", milestone_type)
      .maybeSingle();

    if (checkError) {
      console.error("[log-career-milestone] Error checking existing milestone:", checkError);
      throw checkError;
    }

    if (existingMilestone) {
      console.log(`[log-career-milestone] Milestone ${milestone_type} already achieved, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "Milestone already achieved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template for this milestone type
    const template = MILESTONE_TEMPLATES[milestone_type];
    const finalCategory = category || template?.category || "career";
    const finalContent = content || (template?.contentTemplate ? template.contentTemplate(metadata) : null);

    // Record the milestone as achieved
    const { error: trackError } = await supabaseClient
      .from("player_milestone_tracking")
      .insert({
        profile_id,
        band_id: band_id || null,
        milestone_type,
        metadata,
      });

    if (trackError) {
      console.error("[log-career-milestone] Error tracking milestone:", trackError);
      throw trackError;
    }

    // Create the journal entry
    const { data: journalEntry, error: journalError } = await supabaseClient
      .from("player_journal_entries")
      .insert({
        profile_id,
        band_id: band_id || null,
        entry_type: "milestone",
        category: finalCategory,
        title,
        content: finalContent,
        is_auto_generated: true,
        is_pinned: false,
        metadata,
        related_entity_type: related_entity_type || null,
        related_entity_id: related_entity_id || null,
        occurred_at: occurred_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (journalError) {
      console.error("[log-career-milestone] Error creating journal entry:", journalError);
      throw journalError;
    }

    console.log(`[log-career-milestone] Successfully logged milestone: ${milestone_type}`);

    return new Response(
      JSON.stringify({ success: true, entry: journalEntry }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[log-career-milestone] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
