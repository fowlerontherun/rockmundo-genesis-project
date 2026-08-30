import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-CHECKOUT-RECEIPT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let receipt: Record<string, unknown> | null = null;

    if (sessionId) {
      logStep("Retrieving checkout session", { sessionId });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items", "line_items.data.price.product", "subscription", "payment_intent"],
      });

      const sessionEmail = session.customer_details?.email ?? session.customer_email ?? null;
      if (sessionEmail && sessionEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new Error("This receipt does not belong to the signed-in account");
      }

      const lineItems = (session.line_items?.data ?? []).map((item) => {
        const price = item.price as Stripe.Price | null;
        const product = price?.product as Stripe.Product | string | null;
        return {
          description: item.description ?? (typeof product === "object" ? product?.name : null) ?? "Purchase",
          quantity: item.quantity ?? 1,
          amount_total: item.amount_total ?? 0,
          currency: item.currency ?? session.currency ?? "usd",
          price_id: price?.id ?? null,
          interval: price?.recurring?.interval ?? null,
          interval_count: price?.recurring?.interval_count ?? null,
        };
      });

      const subscription = typeof session.subscription === "object" ? session.subscription : null;
      const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;

      let receiptUrl: string | null = null;
      if (paymentIntent?.latest_charge) {
        const chargeId = typeof paymentIntent.latest_charge === "string"
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge.id;
        try {
          const charge = await stripe.charges.retrieve(chargeId);
          receiptUrl = charge.receipt_url ?? null;
        } catch (chargeError) {
          logStep("Could not fetch charge receipt", { message: String(chargeError) });
        }
      }

      receipt = {
        session_id: session.id,
        mode: session.mode,
        purchase_type: session.metadata?.purchase_type
          ?? (session.mode === "subscription" ? "vip" : session.metadata?.type ?? "purchase"),
        payment_status: session.payment_status,
        status: session.status,
        amount_total: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        created: session.created,
        customer_email: sessionEmail,
        metadata: session.metadata ?? {},
        line_items: lineItems,
        receipt_url: receiptUrl,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_end: (subscription as unknown as { current_period_end?: number }).current_period_end ?? null,
            }
          : null,
      };
    }

    // Current subscription state, independent of the session
    let currentSubscription: Record<string, unknown> | null = null;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "all",
        limit: 5,
      });
      const active = subs.data.find((s) => s.status === "active" || s.status === "trialing") ?? subs.data[0];
      if (active) {
        const item = active.items.data[0];
        currentSubscription = {
          id: active.id,
          status: active.status,
          cancel_at_period_end: active.cancel_at_period_end,
          current_period_end: (active as unknown as { current_period_end?: number }).current_period_end ?? null,
          amount: item?.price?.unit_amount ?? null,
          currency: item?.price?.currency ?? null,
          interval: item?.price?.recurring?.interval ?? null,
          interval_count: item?.price?.recurring?.interval_count ?? null,
          price_id: item?.price?.id ?? null,
        };
      }
    }

    return new Response(JSON.stringify({ receipt, currentSubscription }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
