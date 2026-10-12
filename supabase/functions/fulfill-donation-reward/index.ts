import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers, status });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) throw new Error("Stripe unavailable");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Authentication required" }, 401);
    const { session_id, profile_id } = await req.json();
    if (typeof session_id !== "string" || !session_id.startsWith("cs_") ||
        typeof profile_id !== "string") return json({ error: "Invalid checkout request" }, 400);
    const stripe = new Stripe(secret, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.metadata?.user_id !== auth.user.id ||
        session.metadata?.purchase_type !== "donation" ||
        session.mode !== "payment" ||
        session.status !== "complete" ||
        session.payment_status !== "paid") {
      return json({ error: "No verified paid donation for this account" }, 403);
    }
    const { data, error } = await admin.rpc("redeem_verified_donation_reward", {
      p_user_id: auth.user.id,
      p_profile_id: profile_id,
      p_session_id: session.id,
    });
    if (error) throw error;
    return json({ success: true, redemption: data });
  } catch (err) {
    console.error("[DONATION-REWARD] Processing failed", err instanceof Error ? err.message : "unknown");
    return json({ error: "Could not verify and redeem donation rewards" }, 500);
  }
});
