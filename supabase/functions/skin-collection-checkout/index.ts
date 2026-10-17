import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Every skin collection set is sold at £1.99 (real money).
const SKIN_SET_PRICE_ID = "price_1URXiTAzic6whdustcXsxNSX";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    if (body.action === "verify") {
      const sessionId = String(body.sessionId ?? "");
      if (!sessionId) return json({ error: "Missing session" }, 400);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.purchase_type !== "skin_collection" || session.metadata?.user_id !== user.id) {
        return json({ error: "This payment does not belong to you." }, 403);
      }
      if (session.payment_status !== "paid") return json({ status: "unpaid" });
      const { data, error } = await admin.rpc("grant_paid_skin_collection", {
        p_session_id: session.id,
        p_user_id: user.id,
        p_profile_id: session.metadata.profile_id,
        p_collection_id: session.metadata.collection_id,
        p_amount_minor: session.amount_total ?? 0,
        p_currency: session.currency ?? "gbp",
      });
      if (error) throw error;
      return json(data);
    }

    const collectionId = String(body.collectionId ?? "");
    const profileId = String(body.profileId ?? "");
    const { data: profile } = await admin.from("profiles").select("id").eq("id", profileId).eq("user_id", user.id).maybeSingle();
    if (!profile) return json({ error: "Character not found." }, 403);
    const { data: collection } = await admin.from("skin_collections").select("id,name,is_active").eq("id", collectionId).maybeSingle();
    if (!collection?.is_active) return json({ error: "This collection is not on sale." }, 404);
    const { data: owned } = await admin.from("skin_collection_purchases").select("id").eq("profile_id", profileId).eq("collection_id", collectionId).maybeSingle();
    if (owned) return json({ error: "This character already owns this set." }, 409);

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    const origin = req.headers.get("origin") || "https://rockmundo.uk";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: SKIN_SET_PRICE_ID, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/skin-store?set_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/skin-store`,
      metadata: { user_id: user.id, profile_id: profileId, collection_id: collectionId, purchase_type: "skin_collection" },
    });
    return json({ url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
