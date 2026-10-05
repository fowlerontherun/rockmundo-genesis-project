import Stripe from "npm:stripe@22";
import { withSupabase } from "npm:@supabase/server@1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string);

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { data: role, error: roleError } = await ctx.supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userClaims!.sub)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !role) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const startingAfter = url.searchParams.get("starting_after");
    const created: Stripe.RangeQueryParam = {};

    if (from) created.gte = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    if (to) created.lte = Math.floor(new Date(`${to}T23:59:59.999Z`).getTime() / 1000);

    const page = await stripe.balanceTransactions.list({
      limit: 100,
      ...(Object.keys(created).length ? { created } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const transactions = page.data.map((tx) => ({
      id: tx.id,
      created: new Date(tx.created * 1000).toISOString(),
      type: tx.type,
      amount: tx.amount,
      fee: tx.fee,
      net: tx.net,
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      reporting_category: tx.reporting_category,
      source: typeof tx.source === "string" ? tx.source : tx.source?.id ?? null,
    }));

    const summary = transactions.reduce(
      (acc, tx) => ({
        gross: acc.gross + tx.amount,
        fees: acc.fees + tx.fee,
        net: acc.net + tx.net,
      }),
      { gross: 0, fees: 0, net: 0 },
    );

    return Response.json({
      transactions,
      summary: { ...summary, count: transactions.length },
      has_more: page.has_more,
      next_cursor: page.has_more ? page.data.at(-1)?.id ?? null : null,
      range: { from, to },
    });
  }),
};