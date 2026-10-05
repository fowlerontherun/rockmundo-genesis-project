import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const periodEndOf = (sub: any): Date => {
  const legacy = sub?.current_period_end;
  const fromItems = Math.max(0, ...((sub?.items?.data ?? []).map((i: any) => i?.current_period_end ?? 0)));
  const end = legacy || fromItems;
  return end ? new Date(end * 1000) : new Date(Date.now() + 30 * 86400000);
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    logStep("Stripe configuration verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing Stripe signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let event: Stripe.Event;
    try {
      const cryptoProvider = Stripe.createSubtleCryptoProvider();
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        cryptoProvider,
      );
      logStep("Webhook signature verified");
    } catch (err) {
      const verificationError = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { message: verificationError });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event type", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        const userId = session.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in metadata");
          break;
        }

        if (session.mode !== "subscription" || !session.subscription) {
          logStep("Checkout session does not require subscription handling", {
            sessionId: session.id,
            mode: session.mode,
            purchaseType: session.metadata?.purchase_type ?? null,
          });
          break;
        }

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = periodEndOf(subscription);

        const row = {
          user_id: userId,
          status: "active",
          subscription_type: "paid",
          starts_at: new Date().toISOString(),
          expires_at: currentPeriodEnd.toISOString(),
          stripe_subscription_id: subscriptionId,
        };
        const { data: existingRow } = await supabaseClient
          .from("vip_subscriptions").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
        const { error } = existingRow
          ? await supabaseClient.from("vip_subscriptions").update({ status: "active", expires_at: row.expires_at }).eq("id", existingRow.id)
          : await supabaseClient.from("vip_subscriptions").insert(row);

        if (error) {
          logStep("Error creating VIP subscription", { message: error.message });
          throw new Error(`Failed to persist VIP subscription: ${error.message}`);
        } else {
          logStep("VIP subscription created/updated", { userId, expiresAt: currentPeriodEnd.toISOString() });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id, amountPaid: invoice.amount_paid });

        if ((invoice.amount_paid ?? 0) <= 0) {
          logStep("Ignoring zero-value invoice for referral rewards", { invoiceId: invoice.id });
          break;
        }

        const parent = invoice.parent;
        const subscriptionRef = parent?.type === "subscription_details"
          ? parent.subscription_details?.subscription
          : null;
        const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;

        if (!subscriptionId) {
          logStep("Paid invoice is not linked to a subscription", { invoiceId: invoice.id });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.user_id || parent?.subscription_details?.metadata?.user_id;
        if (!userId) {
          logStep("No RockMundo user_id on paid subscription", { subscriptionId });
          break;
        }

        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : new Date().toISOString();

        const { data, error } = await supabaseClient.rpc("mark_referral_vip_paid", {
          p_referred_user_id: userId,
          p_invoice_id: invoice.id,
          p_paid_at: paidAt,
        });

        if (error) {
          logStep("Failed to mark referral VIP payment", { message: error.message, userId, invoiceId: invoice.id });
          throw new Error(`Failed to persist referral VIP payment: ${error.message}`);
        } else {
          logStep("Referral VIP payment processed", { userId, invoiceId: invoice.id, referralFound: data });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id, status: subscription.status });

        const userId = subscription.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in subscription metadata");
          break;
        }

        const currentPeriodEnd = periodEndOf(subscription);
        const status = subscription.status === "active" ? "active" :
                       subscription.status === "canceled" ? "cancelled" : "expired";

        const { error } = await supabaseClient
          .from("vip_subscriptions")
          .update({
            status,
            expires_at: currentPeriodEnd.toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { message: error.message });
          throw new Error(`Failed to update VIP subscription: ${error.message}`);
        } else {
          logStep("Subscription updated in DB", { status, expiresAt: currentPeriodEnd.toISOString() });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error } = await supabaseClient
          .from("vip_subscriptions")
          .update({
            status: "cancelled",
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error marking subscription cancelled", { message: error.message });
          throw new Error(`Failed to cancel VIP subscription: ${error.message}`);
        } else {
          logStep("Subscription marked as cancelled");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id, customerId: invoice.customer });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
