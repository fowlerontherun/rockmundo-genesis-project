import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Submission {
  id: string;
  band_id: string;
  status: string;
  media_id: string;
  media_type: string;
  band_fame?: number;
  min_fame_required?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[process-media-submissions] Starting processing...");

    const results = {
      newspaper: { processed: 0, approved: 0, rejected: 0 },
      magazine: { processed: 0, approved: 0, rejected: 0 },
      podcast: { processed: 0, approved: 0, rejected: 0 },
    };

    // Process newspaper submissions
    console.log("[process-media-submissions] Processing newspaper submissions...");
    const { data: newspaperSubs, error: newsError } = await supabase
      .from("newspaper_submissions")
      .select(`
        id, band_id, status, newspaper_id,
        bands!inner(fame),
        newspapers!inner(min_fame_required, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max)
      `)
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (newsError) {
      console.error("[process-media-submissions] Error fetching newspaper submissions:", newsError);
    } else if (newspaperSubs && newspaperSubs.length > 0) {
      for (const sub of newspaperSubs) {
        results.newspaper.processed++;
        const bandFame = (sub.bands as any)?.fame ?? 0;
        const minFame = (sub.newspapers as any)?.min_fame_required ?? 0;
        const isEligible = bandFame >= minFame;

        // 70% approval rate for eligible submissions
        const approved = isEligible && Math.random() < 0.7;

        if (approved) {
          const newspaper = sub.newspapers as any;
          const fameBoost = Math.floor(Math.random() * (newspaper.fame_boost_max - newspaper.fame_boost_min + 1)) + newspaper.fame_boost_min;
          const fanBoost = Math.floor(Math.random() * (newspaper.fan_boost_max - newspaper.fan_boost_min + 1)) + newspaper.fan_boost_min;
          const compensation = Math.floor(Math.random() * (newspaper.compensation_max - newspaper.compensation_min + 1)) + newspaper.compensation_min;

          await supabase
            .from("newspaper_submissions")
            .update({
              status: "approved",
              reviewed_at: new Date().toISOString(),
              fame_boost: fameBoost,
              fan_boost: fanBoost,
              compensation: compensation,
            })
            .eq("id", sub.id);

          results.newspaper.approved++;
          console.log(`[process-media-submissions] Approved newspaper submission ${sub.id} with fame:${fameBoost}, fans:${fanBoost}, $${compensation}`);
        } else {
          await supabase
            .from("newspaper_submissions")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              rejection_reason: isEligible ? "Editorial decision" : "Fame requirement not met",
            })
            .eq("id", sub.id);

          results.newspaper.rejected++;
          console.log(`[process-media-submissions] Rejected newspaper submission ${sub.id}`);
        }
      }
    }

    // Process magazine submissions
    console.log("[process-media-submissions] Processing magazine submissions...");
    const { data: magazineSubs, error: magError } = await supabase
      .from("magazine_submissions")
      .select(`
        id, band_id, status, magazine_id,
        bands!inner(fame),
        magazines!inner(min_fame_required, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max)
      `)
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (magError) {
      console.error("[process-media-submissions] Error fetching magazine submissions:", magError);
    } else if (magazineSubs && magazineSubs.length > 0) {
      for (const sub of magazineSubs) {
        results.magazine.processed++;
        const bandFame = (sub.bands as any)?.fame ?? 0;
        const minFame = (sub.magazines as any)?.min_fame_required ?? 0;
        const isEligible = bandFame >= minFame;

        const approved = isEligible && Math.random() < 0.65;

        if (approved) {
          const magazine = sub.magazines as any;
          const fameBoost = Math.floor(Math.random() * (magazine.fame_boost_max - magazine.fame_boost_min + 1)) + magazine.fame_boost_min;
          const fanBoost = Math.floor(Math.random() * (magazine.fan_boost_max - magazine.fan_boost_min + 1)) + magazine.fan_boost_min;
          const compensation = Math.floor(Math.random() * (magazine.compensation_max - magazine.compensation_min + 1)) + magazine.compensation_min;

          await supabase
            .from("magazine_submissions")
            .update({
              status: "approved",
              reviewed_at: new Date().toISOString(),
              fame_boost: fameBoost,
              fan_boost: fanBoost,
              compensation: compensation,
            })
            .eq("id", sub.id);

          results.magazine.approved++;
          console.log(`[process-media-submissions] Approved magazine submission ${sub.id}`);
        } else {
          await supabase
            .from("magazine_submissions")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              rejection_reason: isEligible ? "Not selected for this issue" : "Fame requirement not met",
            })
            .eq("id", sub.id);

          results.magazine.rejected++;
          console.log(`[process-media-submissions] Rejected magazine submission ${sub.id}`);
        }
      }
    }

    // Process podcast submissions
    console.log("[process-media-submissions] Processing podcast submissions...");
    const { data: podcastSubs, error: podError } = await supabase
      .from("podcast_submissions")
      .select(`
        id, band_id, status, podcast_id,
        bands!inner(fame),
        podcasts!inner(min_fame_required, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max)
      `)
      .eq("status", "pending")
      .lt("submitted_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    if (podError) {
      console.error("[process-media-submissions] Error fetching podcast submissions:", podError);
    } else if (podcastSubs && podcastSubs.length > 0) {
      for (const sub of podcastSubs) {
        results.podcast.processed++;
        const bandFame = (sub.bands as any)?.fame ?? 0;
        const minFame = (sub.podcasts as any)?.min_fame_required ?? 0;
        const isEligible = bandFame >= minFame;

        const approved = isEligible && Math.random() < 0.75;

        if (approved) {
          const podcast = sub.podcasts as any;
          const fameBoost = Math.floor(Math.random() * ((podcast.fame_boost_max || 50) - (podcast.fame_boost_min || 10) + 1)) + (podcast.fame_boost_min || 10);
          const fanBoost = Math.floor(Math.random() * ((podcast.fan_boost_max || 200) - (podcast.fan_boost_min || 50) + 1)) + (podcast.fan_boost_min || 50);
          const compensation = Math.floor(Math.random() * ((podcast.compensation_max || 1000) - (podcast.compensation_min || 100) + 1)) + (podcast.compensation_min || 100);

          await supabase
            .from("podcast_submissions")
            .update({
              status: "approved",
              reviewed_at: new Date().toISOString(),
              fame_boost: fameBoost,
              fan_boost: fanBoost,
              compensation: compensation,
            })
            .eq("id", sub.id);

          results.podcast.approved++;
          console.log(`[process-media-submissions] Approved podcast submission ${sub.id}`);
        } else {
          await supabase
            .from("podcast_submissions")
            .update({
              status: "rejected",
              reviewed_at: new Date().toISOString(),
              rejection_reason: isEligible ? "Schedule full" : "Fame requirement not met",
            })
            .eq("id", sub.id);

          results.podcast.rejected++;
          console.log(`[process-media-submissions] Rejected podcast submission ${sub.id}`);
        }
      }
    }

    console.log("[process-media-submissions] Processing complete:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[process-media-submissions] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
