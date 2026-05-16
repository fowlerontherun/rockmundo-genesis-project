import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Counter-offer negotiation for film & series acting offers.
// Body: { offerId: string, action: 'accept' | 'counter' | 'reject', counterCents?: number }
// Up to 3 counter rounds. Studio acceptance probability scales with fame and how
// modest the counter is vs the studio's base pay.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes.user;
    if (!user) throw new Error("Not authenticated");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const offerId: string = body.offerId;
    const action: string = body.action ?? "counter";
    const counterCents: number = Math.round(body.counterCents ?? 0);

    if (!offerId) throw new Error("offerId required");

    const { data: offer } = await admin
      .from("pr_media_offers").select("*").eq("id", offerId).maybeSingle();
    if (!offer) throw new Error("Offer not found");
    if (offer.status !== "pending") throw new Error("Offer is no longer open");
    if (offer.user_id && offer.user_id !== user.id) throw new Error("Not your offer");

    const { data: profile } = await admin
      .from("profiles").select("id, fame, cash")
      .eq("user_id", user.id).eq("is_active", true).is("died_at", null).maybeSingle();
    if (!profile) throw new Error("No active character");

    const isSeries = offer.media_type === "series";
    const baseCents = Number(
      isSeries ? (offer.pay_per_episode_cents ?? 0)
               : (offer.base_pay_cents ?? Math.round((offer.compensation ?? 0) * 100)),
    );

    // Load or create negotiation
    let { data: neg } = await admin
      .from("acting_negotiations").select("*")
      .eq("offer_id", offerId).maybeSingle();
    if (!neg) {
      const { data: created, error } = await admin.from("acting_negotiations").insert({
        user_id: user.id,
        offer_id: offerId,
        initial_offer_cents: baseCents,
        studio_offer_cents: baseCents,
        round: 1,
        status: "open",
      }).select().single();
      if (error) throw error;
      neg = created;
      await admin.from("pr_media_offers").update({ negotiation_id: neg.id }).eq("id", offerId);
    }
    if (neg.status !== "open") throw new Error(`Negotiation already ${neg.status}`);

    // --- ACCEPT current studio offer
    if (action === "accept") {
      await finalizeAccept(admin, user.id, profile.id, offer, Number(neg.studio_offer_cents), isSeries);
      await admin.from("acting_negotiations").update({
        status: "accepted", closed_at: new Date().toISOString(),
      }).eq("id", neg.id);
      await admin.from("pr_media_offers").update({
        status: "accepted", accepted_at: new Date().toISOString(),
      }).eq("id", offerId);
      return ok({ result: "accepted", final_cents: neg.studio_offer_cents });
    }

    // --- REJECT
    if (action === "reject") {
      await admin.from("acting_negotiations").update({
        status: "rejected", closed_at: new Date().toISOString(),
      }).eq("id", neg.id);
      await admin.from("pr_media_offers").update({ status: "rejected" }).eq("id", offerId);
      return ok({ result: "rejected" });
    }

    // --- COUNTER
    if (counterCents <= 0) throw new Error("counterCents must be > 0");
    if (neg.round >= 3) {
      await admin.from("acting_negotiations").update({
        status: "expired", closed_at: new Date().toISOString(),
      }).eq("id", neg.id);
      await admin.from("pr_media_offers").update({ status: "rejected" }).eq("id", offerId);
      return ok({ result: "studio_walked", reason: "Too many rounds" });
    }

    const studioOffer = Number(neg.studio_offer_cents);
    const ratio = counterCents / studioOffer;
    // Acceptance probability: 95% if counter <= studio, declines as ratio grows
    // Fame helps: every 50k fame adds 5% headroom
    const fameBonus = Math.min(0.30, (Number(profile.fame ?? 0) / 50000) * 0.05);
    const headroom = 1.15 + fameBonus; // up to 1.45x
    let probAccept = 1;
    if (ratio > 1) probAccept = Math.max(0, 1 - ((ratio - 1) / (headroom - 1)));
    // Walk-away if absurd (>2x)
    const walkAway = ratio > 2;

    if (walkAway) {
      await admin.from("acting_negotiations").update({
        status: "rejected", closed_at: new Date().toISOString(),
        player_counter_cents: counterCents,
      }).eq("id", neg.id);
      await admin.from("pr_media_offers").update({ status: "rejected" }).eq("id", offerId);
      return ok({ result: "studio_walked", reason: "Offer was unreasonable" });
    }

    const roll = Math.random();
    if (roll <= probAccept) {
      // Studio agrees to player's counter
      await finalizeAccept(admin, user.id, profile.id, offer, counterCents, isSeries);
      await admin.from("acting_negotiations").update({
        status: "accepted", closed_at: new Date().toISOString(),
        studio_offer_cents: counterCents, player_counter_cents: counterCents,
      }).eq("id", neg.id);
      await admin.from("pr_media_offers").update({
        status: "accepted", accepted_at: new Date().toISOString(),
        base_pay_cents: counterCents,
      }).eq("id", offerId);
      return ok({ result: "accepted", final_cents: counterCents, prob: probAccept });
    }

    // Studio counters between current studio offer and player counter
    const midpoint = Math.round((studioOffer + counterCents) / 2);
    const newStudio = Math.min(counterCents, midpoint);
    const { data: updated } = await admin.from("acting_negotiations").update({
      round: neg.round + 1,
      studio_offer_cents: newStudio,
      player_counter_cents: counterCents,
    }).eq("id", neg.id).select().single();

    return ok({
      result: "counter",
      new_studio_offer_cents: newStudio,
      round: updated?.round ?? neg.round + 1,
      prob_was: probAccept,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[negotiate-acting-offer]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function finalizeAccept(
  admin: any, userId: string, _profileId: string, offer: any, finalCents: number, isSeries: boolean,
) {
  if (isSeries) {
    const episodes = offer.episode_count ?? 10;
    await admin.from("player_series_contracts").insert({
      user_id: userId,
      series_id: offer.series_id,
      season_id: offer.season_id,
      role_name: offer.show_name ?? "Series Role",
      role_type: offer.role_type ?? "supporting",
      pay_per_episode_cents: finalCents,
      episode_count: episodes,
      total_pay_cents: finalCents * episodes,
      status: "active",
    });
    return;
  }
  // Film
  const startDate = offer.proposed_date ?? new Date().toISOString().split("T")[0];
  const filmingDays = 14;
  const end = new Date(startDate);
  end.setDate(end.getDate() + filmingDays);
  const premiere = new Date(end);
  premiere.setMonth(premiere.getMonth() + 6); // 6 months to release
  await admin.from("player_film_contracts").insert({
    user_id: userId,
    film_id: offer.media_outlet_id ?? null,
    film_title: offer.outlet_name ?? "Untitled Production",
    role_type: offer.role_type ?? "cameo",
    status: "accepted",
    filming_start_date: startDate,
    filming_end_date: end.toISOString().split("T")[0],
    premiere_date: premiere.toISOString().split("T")[0],
    contract_year: new Date(startDate).getFullYear(),
    compensation: Math.round(finalCents / 100),
    total_pay_cents: finalCents,
    is_sequel: !!offer.parent_film_id,
    parent_contract_id: offer.parent_film_id ?? null,
  });
}
