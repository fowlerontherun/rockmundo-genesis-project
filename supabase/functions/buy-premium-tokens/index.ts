import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-game cash-to-gem exchange rate. 1 token = $10,000 in-game cash.
const CASH_PER_TOKEN = 10_000;
const MAX_TOKENS_PER_PURCHASE = 500;

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

    const body = await req.json().catch(() => ({}));
    const tokens = Math.floor(Number(body?.tokens ?? 0));
    if (!Number.isFinite(tokens) || tokens <= 0) throw new Error("tokens must be a positive integer");
    if (tokens > MAX_TOKENS_PER_PURCHASE) {
      throw new Error(`Max ${MAX_TOKENS_PER_PURCHASE} tokens per purchase`);
    }

    const cost = tokens * CASH_PER_TOKEN;

    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("id, cash, premium_tokens")
      .eq("user_id", user.id).eq("is_active", true).is("died_at", null)
      .maybeSingle();
    if (profErr || !profile) throw new Error("No active character");

    const cash = profile.cash ?? 0;
    if (cash < cost) {
      return new Response(JSON.stringify({
        error: "INSUFFICIENT_FUNDS",
        message: `You need $${cost.toLocaleString()} (you have $${cash.toLocaleString()}).`,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newCash = cash - cost;
    const newTokens = (profile.premium_tokens ?? 0) + tokens;

    const { error: updErr } = await admin.from("profiles")
      .update({ cash: newCash, premium_tokens: newTokens })
      .eq("id", profile.id);
    if (updErr) throw new Error(`Exchange failed: ${updErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      tokens_added: tokens,
      cash_spent: cost,
      new_cash: newCash,
      new_tokens: newTokens,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[buy-premium-tokens]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
