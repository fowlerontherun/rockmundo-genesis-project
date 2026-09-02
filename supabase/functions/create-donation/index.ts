import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DONATION] ${step}${detailsStr}`);
};

const ALLOWED_CURRENCIES = ["usd", "gbp", "eur"] as const;
type AllowedCurrency = typeof ALLOWED_CURRENCIES[number];
const parseCurrency = (value: unknown): AllowedCurrency => {
  const candidate = typeof value === "string" ? value.toLowerCase() : "";
  return (ALLOWED_CURRENCIES as readonly string[]).includes(candidate)
    ? (candidate as AllowedCurrency)
    : "usd";
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client using the anon key for user authentication
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    logStep("Customer lookup", { customerId: customerId || "new customer" });

    // Determine requested currency (usd | gbp | eur) and optional custom amount
    let requestedCurrency: string | undefined;
    let requestedAmount: unknown;
    try {
      const body = await req.json();
      requestedCurrency = body?.currency;
      requestedAmount = body?.amount;
    } catch {
      requestedCurrency = undefined;
    }
    const currency = parseCurrency(requestedCurrency);

    // Custom donation amount, in minor units (e.g. 500 = £5.00). Optional.
    const MIN_AMOUNT = 100; // 1.00
    const MAX_AMOUNT = 2_000_00; // 2,000.00
    let customAmount: number | null = null;
    if (requestedAmount !== undefined && requestedAmount !== null && requestedAmount !== "") {
      const parsed = typeof requestedAmount === "number" ? requestedAmount : Number(requestedAmount);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new Error("Donation amount must be a whole number of minor currency units");
      }
      if (parsed < MIN_AMOUNT || parsed > MAX_AMOUNT) {
        throw new Error(`Donation amount must be between ${MIN_AMOUNT / 100} and ${MAX_AMOUNT / 100}`);
      }
      customAmount = parsed;
    }
    logStep("Currency resolved", { currency, customAmount });

    // Create a one-time payment session for the donation
    const origin = req.headers.get("origin") || "https://rockmundo-genesis-project.lovable.app";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        customAmount
          ? {
              price_data: {
                currency,
                product: "prod_VBbikEF4yse2uA", // Project Donation product
                unit_amount: customAmount,
              },
              quantity: 1,
            }
          : {
              price: "price_1UBEVqAzic6whdususa1Zkg2yC", // preset Project Donation price
              quantity: 1,
            },
      ],
      mode: "payment",
      currency,
      success_url: `${origin}/donation-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        user_id: user.id,
        purchase_type: "donation",
        donation_type: "project_support",
        currency,
        amount: customAmount ? String(customAmount) : "preset",
      },
    });


    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
