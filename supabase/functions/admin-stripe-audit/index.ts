import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
    }

    const token = authHeader.slice(7);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey || !stripeKey) {
      console.error("[ADMIN-STRIPE-AUDIT] Missing required server configuration");
      return Response.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders });
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      console.warn("[ADMIN-STRIPE-AUDIT] User token validation failed", userError?.message ?? "no user");
      return Response.json({ error: "Authentication required" }, { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: role, error: roleError } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();

    if (roleError) {
      console.error("[ADMIN-STRIPE-AUDIT] Admin role lookup failed", roleError.message);
      return Response.json({ error: "Unable to verify admin access" }, { status: 500, headers: corsHeaders });
    }
    if (!role) return Response.json({ error: "Admin access required" }, { status: 403, headers: corsHeaders });

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const startingAfter = url.searchParams.get("starting_after");

    if (from && Number.isNaN(Date.parse(`${from}T00:00:00Z`))) return Response.json({ error: "Invalid from date" }, { status: 400, headers: corsHeaders });
    if (to && Number.isNaN(Date.parse(`${to}T23:59:59.999Z`))) return Response.json({ error: "Invalid to date" }, { status: 400, headers: corsHeaders });
    if (from && to && from > to) return Response.json({ error: "From date must be on or before to date" }, { status: 400, headers: corsHeaders });

    const created: Stripe.RangeQueryParam = {};
    if (from) created.gte = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    if (to) created.lte = Math.floor(new Date(`${to}T23:59:59.999Z`).getTime() / 1000);

    const stripe = new Stripe(stripeKey);
    const page = await stripe.balanceTransactions.list({
      limit: 100,
      ...(Object.keys(created).length ? { created } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const transactions = page.data.map((tx) => ({
      id: tx.id, created: new Date(tx.created * 1000).toISOString(), type: tx.type,
      amount: tx.amount, fee: tx.fee, net: tx.net, currency: tx.currency, status: tx.status,
      description: tx.description, reporting_category: tx.reporting_category,
      source: typeof tx.source === "string" ? tx.source : tx.source?.id ?? null,
    }));
    const summary = transactions.reduce((acc, tx) => ({
      gross: acc.gross + tx.amount, fees: acc.fees + tx.fee, net: acc.net + tx.net,
    }), { gross: 0, fees: 0, net: 0 });

    return Response.json({
      transactions, summary: { ...summary, count: transactions.length },
      has_more: page.has_more, next_cursor: page.has_more ? page.data.at(-1)?.id ?? null : null,
      range: { from, to },
    }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-STRIPE-AUDIT] Request failed", message);
    return Response.json({ error: "Unable to load Stripe transactions", detail: message }, { status: 500, headers: corsHeaders });
  }
});