import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BAND_POSTING_ROLES = new Set(["leader", "founder", "co-leader", "co_leader", "manager"]);
const PROCESSING_STALE_MS = 10 * 60 * 1000;

interface OutcomeCatalog {
  code: string;
  outcome_group: "engagement" | "growth" | "commerce" | "press" | "collab" | "backfire" | "algo" | "serendipity";
  weight_base: number;
  description_template: string;
  effects: {
    likes_mult?: number;
    replies_add?: number;
    retwaats_add?: number;
    impressions_mult?: number;
    follower_pct?: number;
    sales_add?: number;
    rsvps_add?: number;
  };
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return {
      message: typeof value.message === "string" ? value.message : undefined,
      code: typeof value.code === "string" ? value.code : undefined,
      details: typeof value.details === "string" ? value.details : undefined,
      hint: typeof value.hint === "string" ? value.hint : undefined,
    };
  }
  return { message: String(error) };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration error" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let twaatId: string | null = null;
  let claimTimestamp: string | null = null;
  let isInternalServiceRequest = false;
  let stage = "authenticate";

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const apiKey = req.headers.get("apikey");
    isInternalServiceRequest = token === serviceRoleKey || apiKey === serviceRoleKey;

    if (!isInternalServiceRequest && !token) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    let userId: string | null = null;
    if (!isInternalServiceRequest) {
      stage = "validate-user";
      const { data: authData, error: authError } = await supabase.auth.getUser(token!);
      const user = authData?.user;
      if (authError || !user) return jsonResponse({ error: "Invalid authentication" }, 401);
      userId = user.id;
    }

    stage = "parse-request";
    const body = await req.json();
    twaatId = typeof body?.twaat_id === "string" ? body.twaat_id : null;
    if (!twaatId) return jsonResponse({ error: "twaat_id is required" }, 400);

    stage = "load-twaat";
    const { data: twaat, error: twaatError } = await supabase
      .from("twaats")
      .select("*, account:twaater_accounts(*)")
      .eq("id", twaatId)
      .maybeSingle();

    if (twaatError) throw twaatError;
    if (!twaat || !twaat.account) return jsonResponse({ error: "Twaat not found" }, 404);
    if (twaat.deleted_at) return jsonResponse({ error: "Deleted Twaats cannot be processed" }, 409);
    if (twaat.scheduled_for) return jsonResponse({ error: "Scheduled Twaat has not been published yet" }, 409);

    const ownerType = String(twaat.account.owner_type);
    const ownerId = String(twaat.account.owner_id);

    if (!isInternalServiceRequest) {
      stage = "authorize-account";
      const ownsAccount = await userOwnsTwaaterAccount(supabase, userId!, ownerType, ownerId);
      if (!ownsAccount) return jsonResponse({ error: "You cannot process outcomes for this Twaat" }, 403);
    }

    if (twaat.outcome_code) {
      return jsonResponse({ success: true, already_processed: true, outcome: twaat.outcome_code });
    }

    const existingClaim = twaat.outcome_processing_at ? new Date(twaat.outcome_processing_at).getTime() : 0;
    if (existingClaim && Date.now() - existingClaim < PROCESSING_STALE_MS) {
      return jsonResponse({ success: true, processing: true });
    }

    stage = "claim-outcome";
    claimTimestamp = new Date().toISOString();
    let claimQuery = supabase
      .from("twaats")
      .update({ outcome_processing_at: claimTimestamp })
      .eq("id", twaatId)
      .is("outcome_code", null);

    claimQuery = twaat.outcome_processing_at
      ? claimQuery.eq("outcome_processing_at", twaat.outcome_processing_at)
      : claimQuery.is("outcome_processing_at", null);

    const { data: claimed, error: claimError } = await claimQuery.select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return jsonResponse({ success: true, processing: true });

    stage = "load-catalog";
    const { data: catalog, error: catalogError } = await supabase
      .from("twaater_outcome_catalog")
      .select("code, outcome_group, weight_base, description_template, effects");
    if (catalogError) throw catalogError;
    if (!catalog?.length) throw new Error("Twaater outcome catalogue is empty");

    stage = "calculate-outcome";
    const fame = Number(twaat.account.fame_score) || 0;
    const isLinked = Boolean(twaat.linked_type);
    const contentLength = String(twaat.body || "").length;

    const weights = (catalog as OutcomeCatalog[]).map((outcome) => {
      let weight = Number(outcome.weight_base) || 0;
      if (isLinked && outcome.outcome_group === "commerce") weight *= 2;
      if (fame > 500 && outcome.outcome_group === "press") weight *= 1.5;
      if (contentLength > 200 && outcome.outcome_group === "engagement") weight *= 1.3;
      if (fame < 100 && outcome.outcome_group === "growth") weight *= 1.5;
      return { outcome, weight };
    });

    const totalWeight = weights.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    let selectedOutcome = weights[0].outcome;
    if (totalWeight > 0) {
      let random = Math.random() * totalWeight;
      for (const item of weights) {
        random -= Math.max(0, item.weight);
        if (random <= 0) {
          selectedOutcome = item.outcome;
          break;
        }
      }
    }

    const effects = selectedOutcome.effects || {};
    const baseMetrics = {
      likes: Math.floor(Math.random() * 10) + fame / 20,
      replies: Math.floor(Math.random() * 3),
      retwaats: Math.floor(Math.random() * 5),
      impressions: Math.floor(Math.random() * 50) + fame * 2,
      clicks: Math.floor(Math.random() * 10),
      rsvps: isLinked && twaat.linked_type === "gig" ? Math.floor(Math.random() * 5) : 0,
      sales: isLinked && ["single", "album"].includes(twaat.linked_type) ? Math.floor(Math.random() * 3) : 0,
    };

    const finalMetrics = {
      likes: Math.floor(baseMetrics.likes * (effects.likes_mult || 1)),
      replies: baseMetrics.replies + (effects.replies_add || 0),
      retwaats: baseMetrics.retwaats + (effects.retwaats_add || 0),
      impressions: Math.floor(baseMetrics.impressions * (effects.impressions_mult || 1)),
      clicks: baseMetrics.clicks,
      rsvps: baseMetrics.rsvps + (effects.rsvps_add || 0),
      sales: baseMetrics.sales + (effects.sales_add || 0),
    };

    stage = "update-metrics";
    const { error: metricsError } = await supabase
      .from("twaat_metrics")
      .update(finalMetrics)
      .eq("twaat_id", twaatId);
    if (metricsError) throw metricsError;

    stage = "finalize-outcome";
    const processedAt = new Date().toISOString();
    const { data: finalised, error: outcomeError } = await supabase
      .from("twaats")
      .update({
        outcome_code: selectedOutcome.code,
        outcome_processed_at: processedAt,
        outcome_processing_at: null,
      })
      .eq("id", twaatId)
      .eq("outcome_processing_at", claimTimestamp)
      .is("outcome_code", null)
      .select("id")
      .maybeSingle();
    if (outcomeError) throw outcomeError;
    if (!finalised) return jsonResponse({ success: true, processing: true });
    claimTimestamp = null;

    if (effects.follower_pct) {
      try {
        const followerGain = Math.max(0, Math.ceil((Number(twaat.account.follower_count) || 0) * (effects.follower_pct / 100)));
        if (followerGain > 0) {
          await supabase
            .from("twaater_accounts")
            .update({ follower_count: (Number(twaat.account.follower_count) || 0) + followerGain })
            .eq("id", twaat.account_id);
        }
      } catch (followerError) {
        console.error("[twaater-outcome-engine] follower effect failed", followerError);
      }
    }

    try {
      let bandId: string | null = ownerType === "band" ? ownerId : null;
      if (!bandId && ownerType === "persona") {
        const { data: profile } = await supabase.from("profiles").select("user_id").eq("id", ownerId).maybeSingle();
        let memberQuery = supabase
          .from("band_members")
          .select("band_id")
          .eq("member_status", "active")
          .limit(1);
        memberQuery = profile?.user_id
          ? memberQuery.or(`profile_id.eq.${ownerId},user_id.eq.${profile.user_id}`)
          : memberQuery.eq("profile_id", ownerId);
        const { data: bandMember } = await memberQuery.maybeSingle();
        bandId = bandMember?.band_id || null;
      }

      if (bandId) {
        const { data: band } = await supabase
          .from("bands")
          .select("fan_sentiment_score, media_intensity, morale, reputation_score")
          .eq("id", bandId)
          .maybeSingle();

        if (band) {
          const currentSentiment = Number((band as any).fan_sentiment_score) || 0;
          const currentIntensity = Number((band as any).media_intensity) || 0;
          const currentMorale = Number((band as any).morale) || 50;
          const currentReputation = Number((band as any).reputation_score) || 0;
          const isViral = selectedOutcome.code.includes("viral") || (effects.follower_pct ?? 0) >= 5;
          const newSentiment = Math.min(100, currentSentiment + 3);

          await supabase.from("bands").update({
            fan_sentiment_score: newSentiment,
            media_intensity: Math.min(100, currentIntensity + 3),
            morale: Math.min(100, currentMorale + (isViral ? 3 : 1)),
            reputation_score: Math.min(100, currentReputation + (isViral ? 2 : 0)),
          } as any).eq("id", bandId);

          await supabase.from("band_sentiment_events").insert({
            band_id: bandId,
            event_type: "twaater_post",
            sentiment_change: 3,
            media_intensity_change: 3,
            sentiment_after: newSentiment,
            source: "twaater-outcome-engine",
            description: isViral ? "Viral social media post! Morale and reputation boosted" : "Social media post boosted fan engagement",
          });
        }
      }
    } catch (sentimentError) {
      console.error("[twaater-outcome-engine] sentiment effect failed", sentimentError);
    }

    try {
      if (twaat.linked_type && ["album", "single"].includes(twaat.linked_type) && twaat.linked_id) {
        let releaseId: string | null = twaat.linked_type === "album" ? twaat.linked_id : null;

        if (twaat.linked_type === "single") {
          const { data: releaseLinks } = await supabase
            .from("release_songs")
            .select("release_id")
            .eq("song_id", twaat.linked_id);
          const releaseIds = (releaseLinks || []).map((link: any) => link.release_id).filter(Boolean);

          if (releaseIds.length > 0) {
            const { data: candidateReleases } = await supabase
              .from("releases")
              .select("id, release_type, created_at")
              .in("id", releaseIds)
              .order("created_at", { ascending: false });
            const singleRelease = (candidateReleases || []).find((release: any) => String(release.release_type).toLowerCase() === "single");
            releaseId = singleRelease?.id || candidateReleases?.[0]?.id || null;
          }
        }

        if (releaseId) {
          const isViral = selectedOutcome.code.includes("viral") || (effects.follower_pct ?? 0) >= 5;
          const baseHypeBoost = isViral ? 12 : 5;
          const engagementScale = Math.min(1 + (finalMetrics.likes + finalMetrics.retwaats * 2) / 50, 3);
          const hypeBoost = Math.floor(baseHypeBoost * engagementScale);
          const { data: release } = await supabase.from("releases").select("hype_score").eq("id", releaseId).maybeSingle();

          if (release) {
            await supabase
              .from("releases")
              .update({ hype_score: (Number((release as any).hype_score) || 0) + hypeBoost } as any)
              .eq("id", releaseId);
          }
        }
      }
    } catch (hypeError) {
      console.error("[twaater-outcome-engine] release hype effect failed", hypeError);
    }

    return jsonResponse({ success: true, outcome: selectedOutcome.code, metrics: finalMetrics });
  } catch (error) {
    const detail = describeError(error);
    console.error("[twaater-outcome-engine] error", { stage, detail });

    if (twaatId && claimTimestamp) {
      await supabase
        .from("twaats")
        .update({ outcome_processing_at: null })
        .eq("id", twaatId)
        .eq("outcome_processing_at", claimTimestamp);
    }

    if (isInternalServiceRequest) {
      return jsonResponse({ error: "Outcome processing failed", stage, detail }, 500);
    }

    return jsonResponse({ error: detail.message || "Outcome processing failed" }, 500);
  }
});

async function userOwnsTwaaterAccount(
  supabase: any,
  userId: string,
  ownerType: string,
  ownerId: string,
): Promise<boolean> {
  const { data: userProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId);
  if (profilesError) throw profilesError;
  const profileIds = (userProfiles || []).map((profile: any) => String(profile.id));

  if (ownerType === "persona") {
    return ownerId === userId || profileIds.includes(ownerId);
  }

  if (ownerType !== "band") return false;

  const { data: band, error: bandError } = await supabase
    .from("bands")
    .select("id, leader_id")
    .eq("id", ownerId)
    .maybeSingle();
  if (bandError) throw bandError;

  const leaderId = band?.leader_id ? String(band.leader_id) : "";
  if (leaderId === userId || profileIds.includes(leaderId)) return true;

  let membershipQuery = supabase
    .from("band_members")
    .select("role, user_id, profile_id, member_status, is_touring_member")
    .eq("band_id", ownerId)
    .eq("member_status", "active");

  const ownershipTerms = [`user_id.eq.${userId}`];
  for (const profileId of profileIds) ownershipTerms.push(`profile_id.eq.${profileId}`);
  membershipQuery = membershipQuery.or(ownershipTerms.join(","));

  const { data: memberships, error: membershipsError } = await membershipQuery;
  if (membershipsError) throw membershipsError;

  return (memberships || []).some((membership: any) =>
    !membership.is_touring_member && BAND_POSTING_ROLES.has(String(membership.role || "").toLowerCase()),
  );
}
