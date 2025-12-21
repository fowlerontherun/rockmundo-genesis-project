import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

interface MediaOutlet {
  id: string;
  name: string;
  min_fame_required: number;
  min_fans_required?: number;
  compensation_min?: number;
  compensation_max?: number;
  fame_boost_min?: number;
  fame_boost_max?: number;
  fan_boost_min?: number;
  fan_boost_max?: number;
}

interface Band {
  id: string;
  leader_id: string;
  fame: number;
  total_fans: number;
}

const MEDIA_TYPES = ['tv', 'radio', 'podcast', 'newspaper', 'magazine', 'youtube', 'film'] as const;
const OFFER_TYPES = ['general_promo', 'tour_promo', 'release_promo', 'personal_promo'] as const;

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null; bandId?: string }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let offersCreated = 0;
  let bandsProcessed = 0;
  let errorCount = 0;

  try {
    runId = await startJobRun({
      jobName: "generate-pr-offers",
      functionName: "generate-pr-offers",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Get bands to process (either specific band or all active bands)
    let bandsQuery = supabaseClient
      .from('bands')
      .select('id, leader_id, fame, total_fans')
      .eq('status', 'active')
      .gte('fame', 50);

    if (payload?.bandId) {
      bandsQuery = bandsQuery.eq('id', payload.bandId);
    } else {
      bandsQuery = bandsQuery.limit(100);
    }

    const { data: bands, error: bandsError } = await bandsQuery;

    if (bandsError) throw new Error(`Failed to fetch bands: ${bandsError.message}`);

    if (!bands || bands.length === 0) {
      await completeJobRun({
        jobName: "generate-pr-offers",
        runId,
        supabaseClient,
        durationMs: Date.now() - startedAt,
        processedCount: 0,
        errorCount: 0,
        resultSummary: { message: 'No eligible bands found' },
      });

      return new Response(
        JSON.stringify({ message: 'No eligible bands found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch all media outlets
    const [tvNetworks, radioStations, podcasts, newspapers, magazines, youtubeChannels, filmProductions] = await Promise.all([
      supabaseClient.from('tv_networks').select('id, name, min_fame_required, min_fans_required').eq('is_active', true),
      supabaseClient.from('radio_stations').select('id, name, min_fame_required').eq('is_active', true),
      supabaseClient.from('podcasts').select('id, name, min_fame_required, min_fans_required').eq('is_active', true),
      supabaseClient.from('newspapers').select('id, name, min_fame_required, min_fans_required').eq('is_active', true),
      supabaseClient.from('magazines').select('id, name, min_fame_required, min_fans_required').eq('is_active', true),
      supabaseClient.from('youtube_channels').select('id, name, min_fame_required, min_fans_required').eq('is_active', true),
      supabaseClient.from('film_productions').select('id, title, min_fame_required, compensation, fame_boost, fan_boost, film_type').eq('is_active', true),
    ]);

    // Fetch TV shows with compensation info
    const { data: tvShows } = await supabaseClient
      .from('tv_shows')
      .select('id, network_id, show_name, fame_boost_multiplier, fan_boost_multiplier, compensation_range_min, compensation_range_max')
      .eq('is_active', true);

    for (const band of bands as Band[]) {
      try {
        bandsProcessed++;
        const fame = band.fame || 0;
        const fans = band.total_fans || 0;

        // Check existing pending offers for this band
        const { count: pendingCount } = await supabaseClient
          .from('pr_media_offers')
          .select('id', { count: 'exact', head: true })
          .eq('band_id', band.id)
          .eq('status', 'pending');

        if (pendingCount && pendingCount >= 5) continue; // Max 5 pending PR offers

        // Determine how many offers to generate (1-3 based on fame)
        const numOffers = fame > 10000 ? 3 : fame > 5000 ? 2 : 1;
        
        // Randomly select media types for this band
        const availableTypes = MEDIA_TYPES.filter(type => {
          if (type === 'film') return fame >= 25000; // Film requires high fame
          return true;
        });

        for (let i = 0; i < numOffers; i++) {
          const mediaType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
          let mediaOutletId: string | null = null;
          let showId: string | null = null;
          let compensation = 0;
          let fameBoost = 0;
          let fanBoost = 0;

          // Select appropriate outlet based on media type and fame level
          let outletName = '';
          let showName: string | null = null;
          
          switch (mediaType) {
            case 'tv': {
              const eligible = (tvNetworks.data || []).filter((n: any) => fame >= (n.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const network = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = network.id;
              outletName = network.name || 'TV Network';
              
              // Find a show on this network
              const networkShows = (tvShows || []).filter((s: any) => s.network_id === network.id);
              if (networkShows.length > 0) {
                const show = networkShows[Math.floor(Math.random() * networkShows.length)];
                showId = show.id;
                showName = show.show_name;
                compensation = getRandomInt(show.compensation_range_min || 500, show.compensation_range_max || 5000);
                fameBoost = Math.floor(getRandomInt(200, 1500) * (show.fame_boost_multiplier || 1));
                fanBoost = Math.floor(getRandomInt(500, 5000) * (show.fan_boost_multiplier || 1));
              } else {
                compensation = getRandomInt(500, 3000);
                fameBoost = getRandomInt(200, 800);
                fanBoost = getRandomInt(500, 2000);
              }
              break;
            }
            case 'radio': {
              const eligible = (radioStations.data || []).filter((s: any) => fame >= (s.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const station = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = station.id;
              outletName = station.name || 'Radio Station';
              compensation = getRandomInt(200, 2000);
              fameBoost = getRandomInt(100, 600);
              fanBoost = getRandomInt(200, 2000);
              break;
            }
            case 'podcast': {
              const eligible = (podcasts.data || []).filter((p: any) => fame >= (p.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const podcast = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = podcast.id;
              outletName = podcast.name || podcast.podcast_name || 'Podcast';
              compensation = getRandomInt(300, 1500);
              fameBoost = getRandomInt(150, 400);
              fanBoost = getRandomInt(400, 1000);
              break;
            }
            case 'newspaper': {
              const eligible = (newspapers.data || []).filter((n: any) => fame >= (n.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const paper = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = paper.id;
              outletName = paper.name || 'Newspaper';
              compensation = getRandomInt(100, 1000);
              fameBoost = getRandomInt(50, 500);
              fanBoost = getRandomInt(100, 1500);
              break;
            }
            case 'magazine': {
              const eligible = (magazines.data || []).filter((m: any) => fame >= (m.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const mag = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = mag.id;
              outletName = mag.name || 'Magazine';
              compensation = getRandomInt(200, 1500);
              fameBoost = getRandomInt(100, 300);
              fanBoost = getRandomInt(300, 800);
              break;
            }
            case 'youtube': {
              const eligible = (youtubeChannels.data || []).filter((y: any) => fame >= (y.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const channel = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = channel.id;
              outletName = channel.name || 'YouTube Channel';
              compensation = getRandomInt(400, 2500);
              fameBoost = getRandomInt(200, 600);
              fanBoost = getRandomInt(600, 2000);
              break;
            }
            case 'film': {
              const eligible = (filmProductions.data || []).filter((f: any) => fame >= (f.min_fame_required || 0));
              if (eligible.length === 0) continue;
              const film = eligible[Math.floor(Math.random() * eligible.length)];
              mediaOutletId = film.id;
              outletName = film.title || 'Film Production';
              compensation = film.compensation || 50000;
              fameBoost = film.fame_boost || 5000;
              fanBoost = film.fan_boost || 20000;
              break;
            }
          }

          if (!mediaOutletId) continue;

          // Determine offer type
          const offerType = OFFER_TYPES[Math.floor(Math.random() * 3)]; // Exclude personal_promo for bands

          // Set proposed date (3-14 days ahead)
          const proposedDate = new Date();
          proposedDate.setDate(proposedDate.getDate() + getRandomInt(3, 14));

          // Set expiration (7 days from now)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          // Create the offer
          const { error: insertError } = await supabaseClient
            .from('pr_media_offers')
            .insert({
              band_id: band.id,
              user_id: band.leader_id,
              media_type: mediaType,
              media_outlet_id: mediaOutletId,
              show_id: showId,
              outlet_name: outletName,
              show_name: showName,
              offer_type: offerType,
              proposed_date: proposedDate.toISOString().split('T')[0],
              compensation,
              fame_boost: fameBoost,
              fan_boost: fanBoost,
              status: 'pending',
              expires_at: expiresAt.toISOString(),
            });

          if (!insertError) {
            offersCreated++;
          } else {
            console.error(`Failed to create offer for band ${band.id}:`, insertError);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing band ${band.id}:`, error);
      }
    }

    await completeJobRun({
      jobName: "generate-pr-offers",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: bandsProcessed,
      errorCount,
      resultSummary: { offersCreated, bandsProcessed, errorCount },
    });

    return new Response(
      JSON.stringify({ success: true, offers_created: offersCreated, bands_processed: bandsProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    await failJobRun({
      jobName: "generate-pr-offers",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { offersCreated, bandsProcessed, errorCount },
    });

    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
