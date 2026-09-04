import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-SUBSCRIPTION-STATUS] ${step}${detailsStr}`);
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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer for user");
      return new Response(JSON.stringify({ subscription: null, invoices: [], hasCustomer: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.default_payment_method"],
    });

    const ranked = [...subs.data].sort((a, b) => {
      const rank = (s: Stripe.Subscription) =>
        s.status === "active" || s.status === "trialing" ? 0 : s.status === "past_due" || s.status === "unpaid" ? 1 : 2;
      return rank(a) - rank(b) || (b.created ?? 0) - (a.created ?? 0);
    });
    const sub = ranked[0] ?? null;

    let subscription: Record<string, unknown> | null = null;
    if (sub) {
      const item = sub.items.data[0];
      const raw = sub as unknown as {
        current_period_start?: number;
        current_period_end?: number;
      };
      const pm = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
      subscription = {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        cancel_at: sub.cancel_at ?? null,
        canceled_at: sub.canceled_at ?? null,
        ended_at: sub.ended_at ?? null,
        trial_end: sub.trial_end ?? null,
        current_period_start: raw.current_period_start ?? item?.current_period_start ?? null,
        current_period_end: raw.current_period_end ?? item?.current_period_end ?? null,
        amount: item?.price?.unit_amount ?? null,
        currency: item?.price?.currency ?? null,
        interval: item?.price?.recurring?.interval ?? null,
        interval_count: item?.price?.recurring?.interval_count ?? null,
        price_id: item?.price?.id ?? null,
        product_name: typeof item?.price?.product === "object"
          ? (item?.price?.product as Stripe.Product).name
          : null,
        payment_method: pm?.card
          ? { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year }
          : null,
      };
    }

    const invoiceList = await stripe.invoices.list({ customer: customerId, limit: 6 });
    const invoices = invoiceList.data.map((inv) => ({
      id: inv.id,
      number: inv.number ?? null,
      status: inv.status ?? null,
      amount_paid: inv.amount_paid ?? 0,
      amount_due: inv.amount_due ?? 0,
      currency: inv.currency ?? "usd",
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      invoice_pdf: inv.invoice_pdf ?? null,
    }));

    return new Response(JSON.stringify({ subscription, invoices, hasCustomer: true }), {
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
