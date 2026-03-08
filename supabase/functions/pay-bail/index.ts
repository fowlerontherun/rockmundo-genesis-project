import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { imprisonment_id, payer_user_id } = await req.json();

    if (!imprisonment_id || !payer_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing imprisonment_id or payer_user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[pay-bail] Processing bail for imprisonment ${imprisonment_id} paid by ${payer_user_id}`);

    // Get imprisonment details
    const { data: imprisonment, error: impError } = await supabase
      .from("player_imprisonments")
      .select("*, prisons(name)")
      .eq("id", imprisonment_id)
      .eq("status", "imprisoned")
      .single();

    if (impError || !imprisonment) {
      return new Response(
        JSON.stringify({ error: "Imprisonment not found or already released" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bailAmount = imprisonment.bail_amount || 
      Math.floor(imprisonment.debt_amount_cleared * 0.5) + (imprisonment.remaining_sentence_days * 500);

    // Get payer's balance
    const { data: payer, error: payerError } = await supabase
      .from("profiles")
      .select("id, cash, display_name, username")
      .eq("user_id", payer_user_id)
      .single();

    if (payerError || !payer) {
      return new Response(
        JSON.stringify({ error: "Payer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payer.cash < bailAmount) {
      return new Response(
        JSON.stringify({ error: `Insufficient funds. Bail is $${bailAmount}, you have $${payer.cash}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduct bail from payer
    await supabase
      .from("profiles")
      .update({ cash: payer.cash - bailAmount })
      .eq("id", payer.id);

    // Update imprisonment to bailed
    const now = new Date();
    await supabase
      .from("player_imprisonments")
      .update({
        status: "bailed",
        released_at: now.toISOString(),
        bail_paid_by: payer_user_id
      })
      .eq("id", imprisonment_id);

    // Update prisoner's profile
    await supabase
      .from("profiles")
      .update({ is_imprisoned: false })
      .eq("user_id", imprisonment.user_id);

    // Create criminal record (bail still creates a record)
    let behaviorRating: string;
    if (imprisonment.behavior_score >= 90) {
      behaviorRating = "exemplary";
    } else if (imprisonment.behavior_score >= 70) {
      behaviorRating = "good";
    } else if (imprisonment.behavior_score >= 50) {
      behaviorRating = "average";
    } else {
      behaviorRating = "poor";
    }

    await supabase.from("player_criminal_record").insert({
      user_id: imprisonment.user_id,
      imprisonment_id: imprisonment.id,
      offense_type: imprisonment.reason,
      sentence_served_days: imprisonment.original_sentence_days - imprisonment.remaining_sentence_days,
      behavior_rating: behaviorRating,
      escaped: false,
      pardoned: false
    });

    // Notify the released prisoner
    const payerName = payer.display_name || payer.username || "Someone";
    const isSelfBail = payer_user_id === imprisonment.user_id;

    await supabase.from("activity_feed").insert({
      user_id: imprisonment.user_id,
      activity_type: "bailed_out",
      message: isSelfBail 
        ? `💰 You paid $${bailAmount} bail and have been released!`
        : `💰 ${payerName} paid your $${bailAmount} bail! You're free!`,
      metadata: {
        imprisonment_id: imprisonment.id,
        bail_amount: bailAmount,
        paid_by: payer_user_id,
        paid_by_name: payerName
      }
    });

    // If someone else paid, notify them too
    if (!isSelfBail) {
      const { data: prisoner } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", imprisonment.user_id)
        .single();

      const prisonerName = prisoner?.display_name || prisoner?.username || "A player";

      await supabase.from("activity_feed").insert({
        user_id: payer_user_id,
        activity_type: "paid_bail",
        message: `💸 You paid $${bailAmount} to bail out ${prisonerName}!`,
        metadata: {
          imprisonment_id: imprisonment.id,
          bail_amount: bailAmount,
          prisoner_user_id: imprisonment.user_id,
          prisoner_name: prisonerName
        }
      });
    }

    // === PAY BAIL → MORALE & REPUTATION (v1.0.973) ===
    // Getting bailed out is a relief; someone else paying shows loyalty/friendship
    try {
      const { data: bm } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', imprisonment.user_id)
        .eq('is_touring_member', false)
        .limit(1)
        .maybeSingle();
      if (bm?.band_id) {
        const { data: bd } = await supabase.from('bands').select('morale, reputation_score').eq('id', bm.band_id).single();
        if (bd) {
          const curM = (bd as any).morale ?? 50;
          const curR = (bd as any).reputation_score ?? 0;
          // Self-bail = moderate relief; friend bail = big morale boost
          const moraleBoost = isSelfBail ? 5 : 8;
          // Being bailed out by someone else shows community support → small rep boost
          const repBoost = isSelfBail ? 1 : 3;
          await supabase.from('bands').update({
            morale: Math.min(100, curM + moraleBoost),
            reputation_score: Math.min(100, curR + repBoost),
          } as any).eq('id', bm.band_id);
          console.log(`[pay-bail] Bail morale: ${isSelfBail ? 'self' : 'friend'} → morale +${moraleBoost}, rep +${repBoost}`);
        }
      }
    } catch (_e) { /* non-critical */ }

    console.log(`[pay-bail] Successfully bailed out ${imprisonment.user_id} for $${bailAmount}`);

    return new Response(
      JSON.stringify({
        success: true,
        bail_amount: bailAmount,
        prisoner_released: imprisonment.user_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[pay-bail] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
