-- Read-only diagnostics for Support Band Marketplace invitation workflow.

SELECT
  to_regprocedure('public.create_gig_support_offer(uuid,uuid,uuid)') IS NOT NULL AS has_create_offer_rpc,
  to_regprocedure('public.respond_to_gig_support_offer(uuid,text,text)') IS NOT NULL AS has_response_rpc,
  to_regprocedure('public.cancel_gig_support_offer(uuid)') IS NOT NULL AS has_cancel_rpc;

SELECT
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='gig_support_slots'
      AND indexname='gig_support_slots_request_uidx'
  ) AS has_request_idempotency_index,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='gig_support_slots'
      AND indexname='gig_support_slots_one_confirmed_per_gig_uidx'
  ) AS has_one_confirmed_support_index;

SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname='public'
  AND tablename='gig_support_slots'
ORDER BY policyname;

-- Expected authenticated policy surface after the mutation lockdown:
-- SELECT only. INSERT/UPDATE lifecycle changes are provided by SECURITY DEFINER RPCs.

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='gig_support_slots'
  AND column_name IN ('request_id','response_note','revenue_share','status')
ORDER BY ordinal_position;
