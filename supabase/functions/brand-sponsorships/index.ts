import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

type SupabaseClient = ReturnType<typeof createClient>;

type Action =
  | "generate_offers"
  | "accept_offer"
  | "process_payouts"
  | "expire_contracts";

type BrandPartner = {
  id: string;
  name: string;
  wealth_tier: "emerging" | "growth" | "established" | "titan";
  size_index: number | null;
  fame_floor: number | null;
  cooldown_days: number | null;
  focus_slots: string[] | null;
  exclusivity_categories: string[] | null;
  base_offer: number | null;
  bonus_profile: Record<string, unknown> | null;
};

type OfferPayload = {
  action?: Action;
  bandId?: string;
  offerId?: string;
  eventType?: "tour" | "festival" | "venue" | "fame_gain";
  eventName?: string | null;
  fameDelta?: number | null;
  triggeredBy?: string | null;
  terminateContractId?: string | null;
  terminationReason?: string | null;
  minFame?: number | null;
};

const tierWeights: Record<BrandPartner["wealth_tier"], number> = {
  emerging: 0.8,
  growth: 1,
  established: 1.25,
  titan: 1.5,
};

function computeWeight(partner: BrandPartner): number {
  const base = tierWeights[partner.wealth_tier] ?? 1;
  const size = Math.max(0, Math.min(200, partner.size_index ?? 50)) / 100;
  return +(base + size).toFixed(2);
}

function computeCashOffer(partner: BrandPartner, bandFame: number): number {
  const baseOffer = partner.base_offer ?? 5000;
  const fameScalar = 1 + Math.min(2, bandFame / 10000);
  const sizeScalar = 1 + Math.max(0, (partner.size_index ?? 50) / 250);
  return Math.round(baseOffer * fameScalar * sizeScalar);
}

function chooseSlot(partner: BrandPartner): "general" | "tour" | "festival" | "venue" {
  const slots = partner.focus_slots?.length ? partner.focus_slots : ["general"];
  const allowed = slots.filter((slot) =>
    slot === "general" || slot === "tour" || slot === "festival" || slot === "venue"
  );
  return (allowed[0] as "general" | "tour" | "festival" | "venue") ?? "general";
}

function weightedSample<T extends { weight: number }>(items: T[], count: number): T[] {
  const selected: T[] = [];
  const pool = [...items];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let target = Math.random() * totalWeight;

    const index = pool.findIndex((item) => {
      target -= item.weight;
      return target <= 0;
    });

    const chosenIndex = index === -1 ? pool.length - 1 : index;
    selected.push(pool[chosenIndex]);
    pool.splice(chosenIndex, 1);
  }

  return selected;
}

async function handleGenerateOffers(
  supabase: SupabaseClient,
  triggeredBy: string | undefined,
  payload: OfferPayload
) {
  const startedAt = Date.now();
  let runId: string | null = null;
  let offersCreated = 0;
  let bandsProcessed = 0;
  let errorCount = 0;

  try {
    runId = await startJobRun({
      jobName: "brand-sponsorships",
      functionName: "brand-sponsorships",
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: null,
    });

    const minFame = payload.minFame ?? 250;
    const { data: bands, error: bandsError } = await supabase
      .from("bands")
      .select("id, fame")
      .gte("fame", minFame)
      .limit(75);

    if (bandsError) throw bandsError;

    const { data: partners, error: partnersError } = await supabase
      .from("brand_partners")
      .select(
        "id, name, wealth_tier, size_index, fame_floor, cooldown_days, exclusivity_categories, focus_slots, base_offer, bonus_profile"
      );

    if (partnersError) throw partnersError;

    if (!partners || partners.length === 0) {
      await completeJobRun({
        jobName: "brand-sponsorships",
        runId,
        supabaseClient: supabase,
        durationMs: Date.now() - startedAt,
        processedCount: 0,
        errorCount: 0,
        resultSummary: { message: "No brand partners configured" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "No brand partners configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const now = new Date();

    for (const band of bands || []) {
      try {
        bandsProcessed++;

        const { count: pendingCount } = await supabase
          .from("brand_offers")
          .select("id", { head: true, count: "exact" })
          .eq("band_id", band.id)
          .eq("status", "pending");

        if (pendingCount && pendingCount >= 5) continue;

        const eligiblePartners = (partners as BrandPartner[]).filter(
          (partner) => (band.fame ?? 0) >= (partner.fame_floor ?? 0)
        );

        const options = eligiblePartners.map((partner) => ({
          partner,
          weight: computeWeight(partner),
        }));

        const toCreate = weightedSample(options, Math.min(3, options.length));

        for (const { partner, weight } of toCreate) {
          const cooldownDays = partner.cooldown_days ?? 7;
          const cooldownStart = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);

          const { count: recentOffers } = await supabase
            .from("brand_offers")
            .select("id", { head: true, count: "exact" })
            .eq("band_id", band.id)
            .eq("brand_id", partner.id)
            .gte("created_at", cooldownStart.toISOString());

          if (recentOffers && recentOffers > 0) continue;

          const { data: activeContracts } = await supabase
            .from("brand_contracts")
            .select("id, status, exclusivity_category, slot_type, brand_id")
            .eq("band_id", band.id)
            .eq("status", "active");

          const exclusivityConflict = (activeContracts || []).some((contract) =>
            contract.brand_id === partner.id ||
            (partner.exclusivity_categories?.includes(contract.exclusivity_category ?? "") ?? false)
          );

          if (exclusivityConflict) continue;

          const cashOffer = computeCashOffer(partner, band.fame ?? 0);
          const expiresAt = new Date(now.getTime() + (cooldownDays + 3) * 24 * 60 * 60 * 1000);
          const slotType = chooseSlot(partner);
          const exclusivity = partner.exclusivity_categories?.[0] ?? null;

          const { data: inserted, error: offerError } = await supabase
            .from("brand_offers")
            .insert({
              band_id: band.id,
              brand_id: partner.id,
              cash_offer: cashOffer,
              fame_required: partner.fame_floor ?? 0,
              expires_at: expiresAt.toISOString(),
              status: "pending",
              slot_type: slotType,
              exclusivity_category: exclusivity,
              weighting_score: weight,
              metadata: { brand_name: partner.name },
            })
            .select("id")
            .single();

          if (offerError) throw offerError;

          offersCreated++;

          await supabase.from("brand_contract_history").insert({
            contract_id: null,
            event_type: "offer_generated",
            event_details: {
              band_id: band.id,
              brand_id: partner.id,
              offer_id: inserted?.id,
              weighting: weight,
            },
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`[brand-sponsorships] Error processing band ${band.id}:`, error);
      }
    }

    await completeJobRun({
      jobName: "brand-sponsorships",
      runId,
      supabaseClient: supabase,
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
      jobName: "brand-sponsorships",
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: bandsProcessed,
      errorCount,
      resultSummary: { offersCreated, bandsProcessed, errorCount },
      error,
    });

    const message = getErrorMessage(error);
    console.error("[brand-sponsorships] Fatal error:", message);

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleAcceptOffer(supabase: SupabaseClient, payload: OfferPayload) {
  if (!payload.offerId || !payload.bandId) {
    return new Response(
      JSON.stringify({ success: false, message: "offerId and bandId are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const now = new Date();

  const { data: offer, error: offerError } = await supabase
    .from("brand_offers")
    .select("*, brand:brand_id(name, cooldown_days, base_offer)")
    .eq("id", payload.offerId)
    .single();

  if (offerError || !offer) {
    const message = offerError?.message ?? "Offer not found";
    return new Response(JSON.stringify({ success: false, message }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (offer.band_id !== payload.bandId) {
    return new Response(JSON.stringify({ success: false, message: "Offer does not belong to band" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (offer.status !== "pending") {
    return new Response(JSON.stringify({ success: false, message: "Offer is not pending" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (offer.expires_at && new Date(offer.expires_at) < now) {
    await supabase.from("brand_offers").update({ status: "expired" }).eq("id", offer.id);
    return new Response(JSON.stringify({ success: false, message: "Offer already expired" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: activeContracts, error: activeError } = await supabase
    .from("brand_contracts")
    .select("id, brand_id, exclusivity_category, slot_type, status")
    .eq("band_id", payload.bandId)
    .eq("status", "active");

  if (activeError) {
    return new Response(JSON.stringify({ success: false, message: activeError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const exclusivityConflict = (activeContracts || []).some((contract) =>
    contract.brand_id === offer.brand_id ||
    (offer.exclusivity_category && contract.exclusivity_category === offer.exclusivity_category) ||
    (offer.slot_type && contract.slot_type === offer.slot_type)
  );

  if (exclusivityConflict) {
    return new Response(
      JSON.stringify({ success: false, message: "Conflicting active contract for brand slot or exclusivity" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { data: contract, error: contractError } = await supabase
    .from("brand_contracts")
    .insert({
      offer_id: offer.id,
      band_id: payload.bandId,
      brand_id: offer.brand_id,
      status: "active",
      exclusivity_category: offer.exclusivity_category,
      slot_type: offer.slot_type,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      payout_terms: {
        base_cash: offer.cash_offer,
        slot_type: offer.slot_type,
        cooldown_days: offer.brand?.cooldown_days ?? 7,
      },
    })
    .select("id, start_date, end_date, slot_type, exclusivity_category")
    .single();

  if (contractError || !contract) {
    const message = contractError?.message ?? "Failed to activate contract";
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("brand_offers").update({ status: "accepted" }).eq("id", offer.id);

  await supabase.from("brand_contract_history").insert({
    contract_id: contract.id,
    event_type: "activation",
    event_details: {
      offer_id: offer.id,
      brand_id: offer.brand_id,
      start_date: contract.start_date,
      end_date: contract.end_date,
      slot_type: contract.slot_type,
      exclusivity_category: contract.exclusivity_category,
    },
  });

  return new Response(
    JSON.stringify({ success: true, contract_id: contract.id, end_date: contract.end_date }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handlePayouts(supabase: SupabaseClient, payload: OfferPayload) {
  if (!payload.bandId || !payload.eventType) {
    return new Response(
      JSON.stringify({ success: false, message: "bandId and eventType are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const fameDelta = Math.max(0, payload.fameDelta ?? 0);

  const { data: contracts, error: contractsError } = await supabase
    .from("brand_contracts")
    .select("id, band_id, brand_id, slot_type, status, payout_terms")
    .eq("band_id", payload.bandId)
    .eq("status", "active");

  if (contractsError) {
    return new Response(JSON.stringify({ success: false, message: contractsError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const relevantContracts = (contracts || []).filter((contract) =>
    contract.slot_type === "general" || contract.slot_type === payload.eventType
  );

  let payoutCount = 0;

  for (const contract of relevantContracts) {
    const baseAmount = Number((contract.payout_terms as Record<string, unknown>)?.["base_cash"] ?? 0);
    const slotMultiplier =
      payload.eventType === "festival"
        ? 0.15
        : payload.eventType === "tour"
          ? 0.12
          : payload.eventType === "venue"
            ? 0.08
            : 0;

    const fameBonus = payload.eventType === "fame_gain" ? fameDelta * 1.5 : fameDelta * 0.4;
    const basePayoutAmount = Math.round(payload.eventType === "fame_gain" ? 0 : baseAmount * slotMultiplier);
    const bonusAmount = Math.round(fameBonus);

    const { error: payoutError } = await supabase.from("brand_payouts").insert({
      contract_id: contract.id,
      event_type: payload.eventType,
      event_reference: payload.eventName ?? null,
      base_amount: basePayoutAmount,
      bonus_amount: bonusAmount,
      fame_delta: fameDelta,
    });

    if (payoutError) {
      console.error(`[brand-sponsorships] Failed to record payout for contract ${contract.id}`, payoutError);
      continue;
    }

    payoutCount++;

    await supabase.from("brand_contract_history").insert({
      contract_id: contract.id,
      event_type: payload.eventType === "fame_gain" ? "fame_bonus" : "payout",
      event_details: {
        event_type: payload.eventType,
        event_reference: payload.eventName,
        base_amount: basePayoutAmount,
        bonus_amount: bonusAmount,
        fame_delta: fameDelta,
      },
    });
  }

  return new Response(
    JSON.stringify({ success: true, payouts_recorded: payoutCount }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleExpiry(supabase: SupabaseClient, payload: OfferPayload) {
  const now = new Date().toISOString();
  let terminated = 0;
  let expired = 0;
  let offersExpired = 0;

  if (payload.terminateContractId) {
    const { error: terminationError } = await supabase
      .from("brand_contracts")
      .update({
        status: "terminated",
        termination_reason: payload.terminationReason ?? "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.terminateContractId)
      .eq("status", "active");

    if (!terminationError) {
      terminated++;
      await supabase.from("brand_contract_history").insert({
        contract_id: payload.terminateContractId,
        event_type: "termination",
        event_details: { reason: payload.terminationReason ?? "manual" },
      });
    }
  }

  const { data: staleOffers } = await supabase
    .from("brand_offers")
    .select("id")
    .eq("status", "pending")
    .lt("expires_at", now);

  if (staleOffers?.length) {
    const ids = staleOffers.map((offer) => offer.id);
    await supabase.from("brand_offers").update({ status: "expired" }).in("id", ids);
    offersExpired = ids.length;
  }

  const { data: expiringContracts } = await supabase
    .from("brand_contracts")
    .select("id, offer_id")
    .eq("status", "active")
    .lt("end_date", now);

  if (expiringContracts?.length) {
    const ids = expiringContracts.map((contract) => contract.id);
    await supabase.from("brand_contracts").update({ status: "expired" }).in("id", ids);
    expired = ids.length;

    for (const contract of expiringContracts) {
      await supabase.from("brand_contract_history").insert({
        contract_id: contract.id,
        event_type: "expiry",
        event_details: { offer_id: contract.offer_id },
      });

      await supabase.from("brand_payouts").insert({
        contract_id: contract.id,
        event_type: "expiry",
        event_reference: contract.offer_id,
        base_amount: 0,
        bonus_amount: 0,
        fame_delta: 0,
      });
    }
  }

  return new Response(
    JSON.stringify({ success: true, terminated, expired, offers_expired: offersExpired }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = (await safeJson<OfferPayload>(req)) ?? {};
  const action: Action = payload.action ?? "generate_offers";
  const triggeredBy = payload.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ success: false, message: "Missing Supabase environment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (action === "generate_offers") {
    return handleGenerateOffers(supabase, triggeredBy, payload);
  }

  if (action === "accept_offer") {
    return handleAcceptOffer(supabase, payload);
  }

  if (action === "process_payouts") {
    return handlePayouts(supabase, payload);
  }

  if (action === "expire_contracts") {
    return handleExpiry(supabase, payload);
  }

  return new Response(JSON.stringify({ success: false, message: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
