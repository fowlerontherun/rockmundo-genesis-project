-- Keep the refunded paid invoice as a durable entitlement block.
-- Later subscription.updated webhooks cannot reactivate a refunded latest invoice.
CREATE TABLE IF NOT EXISTS public.stripe_vip_refunded_invoices (
 invoice_id text PRIMARY KEY,
 stripe_subscription_id text NOT NULL,
 refunded_event_id text NOT NULL,
 refunded_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vip_refunded_invoice_subscription ON public.stripe_vip_refunded_invoices(stripe_subscription_id);
ALTER TABLE public.stripe_vip_refunded_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_vip_refunded_invoices FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.stripe_vip_refunded_invoices TO service_role;
