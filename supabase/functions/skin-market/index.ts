import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) return json({ error: "Please sign in first." }, 401);

    const body = await req.json().catch(() => ({}));
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://rockmundo.uk";

    // --- Seller payouts (Stripe Connect Express) ---
    if (body.action === "connect_onboard" || body.action === "connect_status") {
      const { data: existing } = await admin.from("seller_payout_accounts").select("*").eq("user_id", user.id).maybeSingle();
      let accountId = existing?.stripe_account_id as string | undefined;
      if (!accountId) {
        if (body.action === "connect_status") return json({ connected: false });
        const account = await stripe.accounts.create({
          type: "express",
          country: "GB",
          email: user.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { user_id: user.id },
        });
        accountId = account.id;
        await admin.from("seller_payout_accounts").insert({ user_id: user.id, stripe_account_id: accountId });
      }
      const account = await stripe.accounts.retrieve(accountId);
      const status = {
        charges_enabled: !!account.charges_enabled,
        payouts_enabled: !!account.payouts_enabled,
        details_submitted: !!account.details_submitted,
      };
      await admin.from("seller_payout_accounts").update({ ...status, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      if (body.action === "connect_status") return json({ connected: true, ...status });
      if (status.charges_enabled && status.details_submitted) {
        const login = await stripe.accounts.createLoginLink(accountId);
        return json({ url: login.url, ...status });
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/skin-store?tab=market&payouts=refresh`,
        return_url: `${origin}/skin-store?tab=market&payouts=done`,
        type: "account_onboarding",
      });
      return json({ url: link.url, ...status });
    }

    // --- Confirm a purchase after returning from checkout ---
    if (body.action === "verify") {
      const sessionId = String(body.sessionId ?? "");
      if (!sessionId) return json({ error: "Missing session" }, 400);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.purchase_type !== "skin_market" || session.metadata?.user_id !== user.id) {
        return json({ error: "This payment does not belong to you." }, 403);
      }
      if (session.payment_status !== "paid") return json({ status: "unpaid" });
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? "";
      const { data, error } = await admin.rpc("complete_skin_market_sale", { p_session_id: session.id, p_payment_intent: pi });
      if (error) throw error;
      if (data?.status === "needs_refund" && pi) {
        await stripe.refunds.create({ payment_intent: pi, reverse_transfer: true, refund_application_fee: true });
      }
      return json(data);
    }

    // --- Start checkout for a listing ---
    if (!isUuid(body.listingId) || !isUuid(body.profileId)) return json({ error: "Invalid request" }, 400);
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_skin_listing", {
      p_listing_id: body.listingId,
      p_buyer_user_id: user.id,
      p_buyer_profile_id: body.profileId,
    });
    if (reserveError) return json({ error: reserveError.message }, 409);

    let label = "Skin Market item";
    if (reserved.listing_kind === "set") {
      const { data: c } = await admin.from("skin_collections").select("name").eq("id", reserved.collection_id).maybeSingle();
      label = `${c?.name ?? "Skin"} — full set`;
    } else {
      const table = reserved.item_type === "clothing" ? "avatar_clothing_items" : "instrument_skin_items";
      const { data: it } = await admin.from(table).select("name").eq("id", reserved.item_id).maybeSingle();
      label = it?.name ?? label;
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const metadata = { user_id: user.id, profile_id: body.profileId, sale_id: reserved.sale_id, listing_id: body.listingId, purchase_type: "skin_market" };
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: reserved.currency, unit_amount: reserved.price_minor, product_data: { name: `Skin Market: ${label}` } } }],
      payment_intent_data: {
        application_fee_amount: reserved.fee_minor,
        transfer_data: { destination: reserved.destination },
        metadata,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60 + 60,
      success_url: `${origin}/skin-store?tab=market&market_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/skin-store?tab=market`,
      metadata,
    });
    await admin.from("skin_market_sales").update({ stripe_session_id: session.id }).eq("id", reserved.sale_id);
    return json({ url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
