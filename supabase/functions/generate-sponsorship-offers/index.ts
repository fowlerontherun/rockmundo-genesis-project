import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const OFFER_TERM_PRESETS = {
  endorsement: {
    deliverables: ["shoot day", "social amplification", "brand idents"],
    duration_days: 90,
    bonus_multiplier: 0.15,
  },
  tour_support: {
    deliverables: ["tour shoutouts", "stage signage", "meet & greet moments"],
    duration_days: 45,
    bonus_multiplier: 0.1,
  },
  content_series: {
    deliverables: ["episodic drops", "behind-the-scenes captures", "live reactions"],
    duration_days: 30,
    bonus_multiplier: 0.2,
  },
} as const;

const MAX_PENDING_PER_ENTITY = 3;
const ENTITY_THROTTLE_HOURS = 36;
const BRAND_COOLDOWN_HOURS = 12;
const EXPIRY_NOTIFICATION_WINDOW_HOURS = 48;
type SponsorshipSupabaseClient = SupabaseClient<Record<string, unknown>, unknown, unknown>;

interface SponsorshipBrand {
  id: string;
  name: string;
  size: string;
  wealth_score: number;
  available_budget: number;
  targeting_flags: string[];
  min_fame_threshold: number;
  exclusivity_pref: boolean;
  cooldown_until?: string | null;
}

interface SponsorshipEntity {
  id: string;
  band_id: string | null;
  brand_flags: string[];
  fame_momentum: number;
  event_attendance_score: number;
  chart_momentum: number;
  max_deals: number;
  active_deals: number;
  last_offer_at?: string | null;
  bands?: { fame: number | null; name: string | null } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient: SponsorshipSupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const now = new Date();
  const startedAt = Date.now();
  let runId: string | null = null;
  let offersCreated = 0;
  let brandsProcessed = 0;
  let notificationsCreated = 0;

  try {
    runId = await startJobRun({
      jobName: "generate-sponsorship-offers",
      functionName: "generate-sponsorship-offers",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { data: brands, error: brandError } = await supabaseClient
      .from("sponsorship_brands")
      .select("*")
      .eq("is_active", true)
      .gt("available_budget", 0)
      .or(
        `cooldown_until.is.null,cooldown_until.lt.${now.toISOString()}`
      )
      .limit(50);

    if (brandError) throw brandError;

    const { data: entities, error: entityError } = await supabaseClient
      .from("sponsorship_entities")
      .select("id, band_id, brand_flags, fame_momentum, event_attendance_score, chart_momentum, max_deals, active_deals, last_offer_at, bands(fame, name)")
      .limit(100);

    if (entityError) throw entityError;

    const validEntities = (entities || []).filter((entity) =>
      (entity.band_id || entity.bands?.fame !== undefined)
    );

    for (const brand of brands || []) {
      brandsProcessed++;

      const candidates = validEntities
        .filter((entity) => isEntityEligible(entity, brand, now))
        .map((entity) => ({
          entity,
          score: calculateMatchScore(entity, brand),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      for (const { entity, score } of candidates) {
        const pendingCount = await getPendingOfferCount(supabaseClient, entity.id);
        if (pendingCount >= MAX_PENDING_PER_ENTITY) continue;
        if (entity.active_deals >= entity.max_deals) continue;

        const offerType = pickOfferType(brand, entity);
        const terms = buildTerms(offerType, brand);
        const expiresAt = randomExpiry();
        const exclusivity = brand.exclusivity_pref || terms.exclusive === true;
        const payout = calculatePayout(brand, entity, offerType, score);

        if ((brand.available_budget ?? 0) < payout) continue;

        const { data: offer, error: insertError } = await supabaseClient
          .from("sponsorship_offers")
          .insert({
            brand_id: brand.id,
            entity_id: entity.id,
            offer_type: offerType,
            payout,
            exclusivity,
            expires_at: expiresAt.toISOString(),
            terms: { ...terms, exclusivity },
            metadata: {
              brand_name: brand.name,
              band_id: entity.band_id,
              momentum_score: terms.momentum_weight,
              match_score: score,
            },
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to create sponsorship offer", insertError);
          continue;
        }

        offersCreated++;
        brand.available_budget = Math.max(0, (brand.available_budget ?? 0) - payout);

        await Promise.all([
          supabaseClient
            .from("sponsorship_brands")
            .update({
              available_budget: brand.available_budget,
              cooldown_until: new Date(now.getTime() + BRAND_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
              last_offer_at: now.toISOString(),
            })
            .eq("id", brand.id),
          supabaseClient
            .from("sponsorship_entities")
            .update({ last_offer_at: now.toISOString() })
            .eq("id", entity.id),
        ]);

        const notification = await supabaseClient
          .from("sponsorship_notifications")
          .insert({
            entity_id: entity.id,
            offer_id: offer.id,
            notification_type: "offer_created",
            message: `${brand.name} sent a ${offerType} sponsorship offer expiring on ${expiresAt.toDateString()}`,
            metadata: {
              expires_at: expiresAt.toISOString(),
              exclusivity,
              payout,
            },
          })
          .select("id")
          .single();

        if (!notification.error) {
          notificationsCreated++;
        }
      }
    }

    const expiringNotifications = await notifyExpiringOffers(supabaseClient);
    notificationsCreated += expiringNotifications;

    await completeJobRun({
      jobName: "generate-sponsorship-offers",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: brandsProcessed,
      errorCount: 0,
      itemsAffected: offersCreated,
      resultSummary: { offersCreated, notificationsCreated },
    });

    return new Response(
      JSON.stringify({ success: true, offers_created: offersCreated, notifications_created: notificationsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    await failJobRun({
      jobName: "generate-sponsorship-offers",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: brandsProcessed,
      errorCount: 1,
      itemsAffected: offersCreated,
      resultSummary: { offersCreated, notificationsCreated },
      error,
    });

    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function isEntityEligible(entity: SponsorshipEntity, brand: SponsorshipBrand, now: Date): boolean {
  const fame = entity.bands?.fame ?? 0;
  const hasFlags = brand.targeting_flags.length === 0 ||
    entity.brand_flags.some((flag) => brand.targeting_flags.includes(flag));
  const notThrottled = !entity.last_offer_at ||
    new Date(entity.last_offer_at).getTime() < now.getTime() - ENTITY_THROTTLE_HOURS * 60 * 60 * 1000;

  return fame >= brand.min_fame_threshold && hasFlags && notThrottled;
}

function calculateMatchScore(entity: SponsorshipEntity, brand: SponsorshipBrand): number {
  const fame = entity.bands?.fame ?? 0;
  const brandWeight = normalizeBrandWeight(brand.size, brand.wealth_score);
  const momentum =
    (entity.fame_momentum ?? 0) * 0.5 +
    (entity.event_attendance_score ?? 0) * 0.3 +
    (entity.chart_momentum ?? 0) * 0.2;

  return brandWeight * (1 + fame / 5000) * (1 + momentum / 100);
}

function normalizeBrandWeight(size: string, wealthScore: number): number {
  const sizeMap: Record<string, number> = {
    enterprise: 1.5,
    major: 1.35,
    growth: 1.15,
    emerging: 1,
  };
  return (sizeMap[size] ?? 1) * Math.max(1, wealthScore / 10);
}

function pickOfferType(brand: SponsorshipBrand, entity: SponsorshipEntity): keyof typeof OFFER_TERM_PRESETS {
  if ((entity.chart_momentum ?? 0) > 50) return "content_series";
  if (brand.size === "enterprise" || brand.size === "major") return "endorsement";
  return "tour_support";
}

function buildTerms(offerType: keyof typeof OFFER_TERM_PRESETS, brand: SponsorshipBrand) {
  const preset = OFFER_TERM_PRESETS[offerType];
  return {
    ...preset,
    exclusive: brand.exclusivity_pref,
    momentum_weight: offerType === "content_series" ? 1.2 : 1,
  };
}

function calculatePayout(
  brand: SponsorshipBrand,
  entity: SponsorshipEntity,
  offerType: keyof typeof OFFER_TERM_PRESETS,
  score: number
): number {
  const fame = entity.bands?.fame ?? 0;
  const base = Math.max(2500, fame * 2 + brand.wealth_score * 150);
  const typeMultiplier = offerType === "endorsement" ? 1.35 : offerType === "content_series" ? 1.2 : 1.05;
  const momentumBonus = Math.min(score / 50, 2);
  return Math.round(base * typeMultiplier * momentumBonus);
}

function randomExpiry(): Date {
  const expires = new Date();
  const days = Math.floor(Math.random() * 7) + 5;
  expires.setDate(expires.getDate() + days);
  return expires;
}

async function getPendingOfferCount(
  supabaseClient: SponsorshipSupabaseClient,
  entityId: string
): Promise<number> {
  const { count } = await supabaseClient
    .from("sponsorship_offers")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId)
    .eq("status", "pending");
  return count ?? 0;
}

async function notifyExpiringOffers(
  supabaseClient: SponsorshipSupabaseClient
): Promise<number> {
  const windowEnd = new Date();
  windowEnd.setHours(windowEnd.getHours() + EXPIRY_NOTIFICATION_WINDOW_HOURS);

  const { data: offers, error } = await supabaseClient
    .from("sponsorship_offers")
    .select("id, entity_id, brand:sponsorship_brands(name), expires_at, expiration_notification_sent")
    .eq("status", "pending")
    .eq("expiration_notification_sent", false)
    .lte("expires_at", windowEnd.toISOString());

  if (error || !offers) {
    if (error) console.error("Failed to load expiring offers", error);
    return 0;
  }

  let created = 0;

  for (const offer of offers) {
    const expiresAt = new Date(offer.expires_at);
    const insert = await supabaseClient
      .from("sponsorship_notifications")
      .insert({
        entity_id: offer.entity_id,
        offer_id: offer.id,
        notification_type: "offer_expiring",
        message: `${offer.brand?.name ?? "A brand"} sponsorship offer expires on ${expiresAt.toDateString()}`,
        metadata: { expires_at: offer.expires_at },
      });

    if (!insert.error) {
      created++;
      await supabaseClient
        .from("sponsorship_offers")
        .update({ expiration_notification_sent: true })
        .eq("id", offer.id);
    }
  }

  return created;
}
