// v1.1.040 - redeploy
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FULFILL-SLOT-PURCHASE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseAnonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAnonClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    if (session.metadata?.purchase_type !== "character_slot") {
      throw new Error("Invalid purchase type");
    }

    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    logStep("Session verified", { sessionId: session.id, paymentStatus: session.payment_status });

    // Get or create character_slots row
    const { data: existing } = await supabaseClient
      .from("character_slots")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentExtra = existing?.extra_slots_purchased ?? 0;
    const currentMax = Math.min(2 + currentExtra, 5);

    if (currentMax >= 5) {
      return new Response(JSON.stringify({ success: false, error: "Already at maximum slots (5)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (existing) {
      const { error } = await supabaseClient
        .from("character_slots")
        .update({
          extra_slots_purchased: currentExtra + 1,
          max_slots: Math.min(currentMax + 1, 5),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("character_slots")
        .insert({
          user_id: user.id,
          extra_slots_purchased: 1,
          max_slots: 3,
        });

      if (error) throw error;
    }

    logStep("Slot granted", { userId: user.id, newExtra: currentExtra + 1 });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
