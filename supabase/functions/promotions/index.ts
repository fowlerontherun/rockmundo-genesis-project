import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PromotionAction = "promotion" | "playlist_submission";

type PromotionRequest = {
  songId: string;
  platformId?: string | null;
  platformName?: string | null;
  budget?: number;
  action?: PromotionAction;
  playlistName?: string | null;
};

type PromotionResponse = {
  success: boolean;
  message: string;
  campaign?: Record<string, unknown> | null;
  statsDelta?: {
    streams: number;
    revenue: number;
    listeners: number;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ success: false, message: "Missing Supabase environment variables" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  let payload: PromotionRequest;

  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ success: false, message: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { songId, platformId, platformName, budget, action, playlistName } = payload;

  if (!songId) {
    return new Response(JSON.stringify({ success: false, message: "Song ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resolvedAction: PromotionAction = action === "playlist_submission" ? "playlist_submission" : "promotion";

  const numericBudget = typeof budget === "number" ? budget : Number(budget ?? 0);
  if (!Number.isFinite(numericBudget) || numericBudget <= 0) {
    return new Response(JSON.stringify({ success: false, message: "A positive budget is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: song, error: songError } = await supabaseClient
    .from("songs")
    .select("id, title, artist_id")
    .eq("id", songId)
    .eq("artist_id", user.id)
    .single();

  if (songError || !song) {
    return new Response(JSON.stringify({ success: false, message: "Song not found for user" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let resolvedPlatformId: string | null = platformId ?? null;
  let resolvedPlatformName: string | null = platformName ?? null;
  let revenuePerPlay = 0.003;

  if (resolvedPlatformId) {
    const { data: platformRecord, error: platformError } = await supabaseClient
      .from("streaming_platforms")
      .select("id, name, revenue_per_play")
      .eq("id", resolvedPlatformId)
      .maybeSingle();

    if (!platformError && platformRecord) {
      resolvedPlatformId = platformRecord.id;
      resolvedPlatformName = platformRecord.name;
      revenuePerPlay = platformRecord.revenue_per_play ?? revenuePerPlay;
    }
  }

  if ((!resolvedPlatformId || !resolvedPlatformName) && platformName) {
    const { data: fallbackPlatform, error: fallbackError } = await supabaseClient
      .from("streaming_platforms")
      .select("id, name, revenue_per_play")
      .ilike("name", platformName)
      .maybeSingle();

    if (!fallbackError && fallbackPlatform) {
      resolvedPlatformId = fallbackPlatform.id;
      resolvedPlatformName = fallbackPlatform.name;
      revenuePerPlay = fallbackPlatform.revenue_per_play ?? revenuePerPlay;
    }
  }

  if (!resolvedPlatformName) {
    resolvedPlatformName = platformName ?? "Unknown Platform";
  }

  const playlistsTargeted = resolvedAction === "playlist_submission"
    ? 1
    : Math.max(5, Math.round(numericBudget / 100));
  const newPlacements = resolvedAction === "playlist_submission"
    ? 1
    : Math.max(1, Math.round(playlistsTargeted * 0.35));
  const streamIncrease = resolvedAction === "playlist_submission"
    ? 6000 + Math.round(numericBudget * 8)
    : Math.max(4000, Math.round(newPlacements * 7000 + numericBudget * 4));
  const listenersDelta = Math.max(250, Math.round(streamIncrease * 0.35));
  const revenueDelta = Math.max(25, Math.round(streamIncrease * revenuePerPlay));

  const status = resolvedAction === "playlist_submission" ? "pending" : "active";
  const campaignType = resolvedAction === "playlist_submission" ? "playlist" : "promotion";
  const responseMessage = resolvedAction === "playlist_submission"
    ? `Submitted to ${playlistName ?? resolvedPlatformName} for review.`
    : `Promotion launched on ${resolvedPlatformName} with a $${Math.round(numericBudget)} budget.`;

  const { data: campaign, error: insertError } = await supabaseClient
    .from("promotion_campaigns")
    .insert({
      user_id: user.id,
      song_id: song.id,
      platform_id: resolvedPlatformId,
      platform_name: resolvedPlatformName,
      campaign_type: campaignType,
      budget: Math.round(numericBudget),
      status,
      playlist_name: playlistName ?? null,
      playlists_targeted: playlistsTargeted,
      new_placements: newPlacements,
      stream_increase: streamIncrease,
      revenue_generated: revenueDelta,
      listeners_generated: listenersDelta,
      message: responseMessage,
    })
    .select()
    .single();

  if (insertError || !campaign) {
    const errorMessage = insertError?.message ?? "Failed to create campaign";
    return new Response(JSON.stringify({ success: false, message: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const response: PromotionResponse = {
    success: true,
    message: responseMessage,
    campaign,
    statsDelta: {
      streams: streamIncrease,
      revenue: revenueDelta,
      listeners: listenersDelta,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
