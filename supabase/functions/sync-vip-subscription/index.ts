import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

const periodEnd = (sub: Stripe.Subscription): number | null => {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (legacy) return legacy;
  const ends = sub.items.data.map((i) => (i as unknown as { current_period_end?: number }).current_period_end ?? 0);
  const max = Math.max(0, ...ends);
  return max > 0 ? max : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user?.email) return json({ synced: false, reason: "unauthenticated" }, 401);
    const user = userData.user;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    let best: Stripe.Subscription | null = null;
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
      for (const s of subs.data) {
        if (s.status !== "active" && s.status !== "trialing") continue;
        if (!best || (periodEnd(s) ?? 0) > (periodEnd(best) ?? 0)) best = s;
      }
    }
    if (!best) return json({ synced: true, active: false });

    const end = periodEnd(best);
    if (!end) return json({ synced: false, reason: "no_period_end" });
    const expiresAt = new Date(end * 1000).toISOString();
    const startsAt = new Date((best.start_date ?? best.created) * 1000).toISOString();

    const { data: existing } = await admin
      .from("vip_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", best.id)
      .maybeSingle();

    if (existing) {
      await admin.from("vip_subscriptions").update({ status: "active", expires_at: expiresAt }).eq("id", existing.id);
    } else {
      await admin.from("vip_subscriptions").insert({
        user_id: user.id,
        status: "active",
        subscription_type: "paid",
        starts_at: startsAt,
        expires_at: expiresAt,
        stripe_subscription_id: best.id,
      });
    }
    console.log("[SYNC-VIP] synced", { userId: user.id, subscriptionId: best.id, expiresAt });
    return json({ synced: true, active: true, expires_at: expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[SYNC-VIP] ERROR", message);
    return json({ synced: false, error: message }, 500);
  }
});
