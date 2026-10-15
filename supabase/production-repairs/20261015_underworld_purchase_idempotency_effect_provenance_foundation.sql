-- Safe prerequisite for replacing the incompatible October 12/13
-- underworld purchase, consumption and arrest migrations.
-- Supports a stable client purchase request key, multi-effect boost
-- attribution and an immutable-at-purchase addiction type snapshot.
-- Adds *only* schema metadata, constraints and indexes. No table row
-- updates, purchases, payments, XP grants, arrests, or RPC activation.
DO $preflight$
BEGIN
 IF to_regclass('public.underworld_purchases') IS NULL
    OR to_regclass('public.player_active_boosts') IS NULL
    OR to_regclass('public.underworld_products') IS NULL
 THEN RAISE EXCEPTION 'UNDERWORLD_TRANSACTION_FOUNDATION_TABLE_MISSING'; END IF;
 IF has_table_privilege('authenticated','public.underworld_purchases','INSERT')
    OR has_table_privilege('authenticated','public.underworld_purchases','UPDATE')
    OR has_table_privilege('authenticated','public.player_active_boosts','INSERT')
    OR has_table_privilege('authenticated','public.player_active_boosts','UPDATE')
 THEN RAISE EXCEPTION 'UNDERWORLD_CLIENT_DML_LOCK_NOT_PRESENT'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='underworld_purchases'
     AND c.relrowsecurity
 ) OR NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='player_active_boosts'
     AND c.relrowsecurity
 ) THEN RAISE EXCEPTION 'UNDERWORLD_RLS_NOT_ENABLED'; END IF;
END $preflight$;

-- A client creates a UUID once for a buy attempt and reuses it on retry.
-- The new buy RPC MUST lock the owning profile, look up a prior committed
-- request, return the same result, and reject mismatched product/price.
-- Do not retroactively generate request IDs for old paid or gifted rows.
ALTER TABLE public.underworld_purchases
  ADD COLUMN IF NOT EXISTS client_request_id uuid;
ALTER TABLE public.underworld_purchases
  ADD CONSTRAINT underworld_request_requires_profile
  CHECK (client_request_id IS NULL OR profile_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS underworld_purchase_profile_request_once
 ON public.underworld_purchases(profile_id,client_request_id)
 WHERE client_request_id IS NOT NULL;

-- Store addiction effects at purchase time, rather than depending on
-- a catalog product that admins may later change before consumption.
ALTER TABLE public.underworld_purchases
 ADD COLUMN IF NOT EXISTS purchased_addiction_type text;
ALTER TABLE public.underworld_purchases
 ADD CONSTRAINT underworld_purchase_addiction_snapshot_valid
 CHECK (purchased_addiction_type IS NULL OR purchased_addiction_type IN
        ('alcohol','substances','gambling','partying'));

-- One underworld product can contain many independent temporary boosts.
-- Keep separate rows for each effect key without duplicating an effect on
-- idempotent retry. Historical boosts have NULL source and are untouched.
ALTER TABLE public.player_active_boosts
  ADD COLUMN IF NOT EXISTS source_purchase_id uuid
  REFERENCES public.underworld_purchases(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS underworld_boost_effect_once_per_purchase
 ON public.player_active_boosts(source_purchase_id,boost_type)
 WHERE source_purchase_id IS NOT NULL;

COMMENT ON COLUMN public.underworld_purchases.client_request_id IS
 'Client-stable idempotency key; new trusted underworld buy RPC must validate it before any debit';
COMMENT ON COLUMN public.underworld_purchases.purchased_addiction_type IS
 'Catalog addiction type frozen at paid purchase and copied into gifted items';
COMMENT ON COLUMN public.player_active_boosts.source_purchase_id IS
 'Provenance of each independently represented temporary product effect';

NOTIFY pgrst,'reload schema';
