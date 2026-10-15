-- #4119. MANUAL-ONLY deployment, deliberately outside normal migrations.
-- Install on a restored, SANITIZED staging database first, after the
-- incremental earnings repair and its writer cutover are verified.
-- Do not apply on production until PITR/restore, rollback and authorization
-- tests pass. No historical payouts or ledger edits are performed here.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.releases') IS NULL
     OR to_regclass('public.release_cost_transactions') IS NULL
     OR to_regclass('public.band_earnings') IS NULL
     OR to_regclass('public.release_sales') IS NULL
     OR to_regprocedure('public._caller_profile_id()') IS NULL
     OR to_regprocedure('public.update_band_balance_from_earnings()') IS NULL THEN
    RAISE EXCEPTION 'Release cancellation prerequisites missing';
  END IF;
END;
$preflight$;

-- Additional database uniqueness: even a second writer cannot record a second
-- canonical refund for the same release under a different idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_cancel_refund_once
  ON public.band_earnings ((metadata->>'release_id'))
  WHERE source='release_cancellation_refund' AND metadata ? 'release_id';

CREATE OR REPLACE FUNCTION public.cancel_release_atomic(p_release_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $cancel$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_release public.releases%ROWTYPE;
  v_cost_rows bigint;
  v_band_cost_minor bigint;
  v_label_cost_minor bigint;
  v_unknown_cost_rows bigint;
  v_charge_rows bigint;
  v_charge_major bigint;
  v_other_charge_rows bigint;
  v_refund_id uuid;
BEGIN
  IF v_uid IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_authenticated_character_required' USING ERRCODE='42501';
  END IF;

  -- A release lock serializes duplicate requests, in-flight format bookings,
  -- worker transitions and any other writer using the same release row.
  SELECT * INTO v_release FROM public.releases
  WHERE id=p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'release_not_found'; END IF;

  -- Account ownership ALONE is insufficient for a band release: the active
  -- character must still be an active member, and must be its creator or leader.
  IF v_release.band_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id=v_release.band_id AND bm.profile_id=v_profile_id
        AND COALESCE(bm.member_status,'active')='active'
    ) OR (
      v_release.user_id IS DISTINCT FROM v_uid
      AND NOT EXISTS (
        SELECT 1 FROM public.bands b
        WHERE b.id=v_release.band_id AND b.leader_id=v_profile_id
      )
    ) THEN
      RAISE EXCEPTION 'release_cancellation_not_authorized' USING ERRCODE='42501';
    END IF;
  ELSIF v_release.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'release_cancellation_not_authorized' USING ERRCODE='42501';
  END IF;

  -- Idempotent retry, including a previously cancelled legacy release:
  -- NEVER make a delayed or second refund from a cancelled row.
  IF v_release.release_status='cancelled' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'refundMajor',0,
      'releaseId',p_release_id);
  END IF;

  IF v_release.release_status NOT IN ('draft','manufacturing') THEN
    RAISE EXCEPTION 'release_no_longer_cancellable';
  END IF;
  IF v_release.manufacturing_complete_at IS NOT NULL
     AND v_release.manufacturing_complete_at <= now() THEN
    RAISE EXCEPTION 'release_manufacturing_already_completed';
  END IF;
  IF COALESCE(v_release.total_units_sold,0)>0
     OR COALESCE(v_release.total_revenue,0)>0
     OR EXISTS (
       SELECT 1 FROM public.release_formats rf
       JOIN public.release_sales rs ON rs.release_format_id=rf.id
       WHERE rf.release_id=p_release_id
     ) THEN
    RAISE EXCEPTION 'release_has_sales_cannot_refund';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.release_formats rf WHERE rf.release_id=p_release_id
      AND rf.manufacturing_status='completed'
  ) THEN
    RAISE EXCEPTION 'release_format_already_manufactured';
  END IF;

  -- The current production SUM-based trigger would overwrite gameplay
  -- booking deductions. Refuse refunds until the controlled delta repair
  -- has actually been installed (a merged PR is not proof of deployment).
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid='public.update_band_balance_from_earnings()'::regprocedure
      AND pg_catalog.pg_get_functiondef(p.oid) ILIKE '%SUM(amount)%'
  ) THEN
    RAISE EXCEPTION 'incremental_earnings_trigger_required';
  END IF;

  -- Never trust a client-sent refund number or the aggregate releases.total_cost.
  -- That aggregate includes label-paid and sometimes historically unproven
  -- expenses; use actual payer receipts and original band debit postings.
  SELECT count(*),
         COALESCE(sum(c.amount_minor) FILTER (WHERE c.payer_type='band'),0),
         COALESCE(sum(c.amount_minor) FILTER (WHERE c.payer_type='label'),0),
         count(*) FILTER (WHERE c.payer_type NOT IN ('band','label'))
    INTO v_cost_rows,v_band_cost_minor,v_label_cost_minor,v_unknown_cost_rows
  FROM public.release_cost_transactions c
  WHERE c.release_id=p_release_id;

  IF v_label_cost_minor>0 OR v_unknown_cost_rows>0 THEN
    RAISE EXCEPTION 'release_refund_requires_manual_payer_reconciliation';
  END IF;

  IF v_cost_rows=0 AND COALESCE(v_release.total_cost,0)<>0 THEN
    RAISE EXCEPTION 'release_paid_cost_has_no_verified_receipts';
  END IF;
  IF (v_band_cost_minor+v_label_cost_minor) IS DISTINCT FROM
     COALESCE(v_release.total_cost,0)::bigint THEN
    RAISE EXCEPTION 'release_cost_receipts_do_not_match_authoritative_total';
  END IF;

  SELECT count(*) FILTER (WHERE e.source='release' AND e.amount<0),
         COALESCE(-sum(e.amount) FILTER (WHERE e.source='release' AND e.amount<0),0)::bigint,
         count(*) FILTER (WHERE e.source<>'release' OR e.amount>=0
                          OR e.band_id IS DISTINCT FROM v_release.band_id)
    INTO v_charge_rows,v_charge_major,v_other_charge_rows
  FROM public.band_earnings e
  WHERE e.metadata->>'release_id'=p_release_id::text;

  IF v_other_charge_rows>0
     OR (v_cost_rows>0 AND v_charge_rows=0)
     OR (v_cost_rows=0 AND v_charge_rows>0)
     OR v_charge_major<0 OR v_charge_major>2147483647
     OR v_band_cost_minor<>v_charge_major*100 THEN
    -- Integer band earnings are whole major units while some historic cost
    -- receipts are fractional. Ambiguity is a hard stop, not a rounded refund.
    RAISE EXCEPTION 'release_refund_ledger_evidence_inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_earnings e
    WHERE e.metadata->>'release_id'=p_release_id::text
      AND e.source IN ('refund','release_cancellation_refund')
  ) THEN
    -- Covers old client-flow partial failures before they transitioned status.
    RAISE EXCEPTION 'release_refund_already_recorded';
  END IF;

  UPDATE public.releases SET release_status='cancelled',updated_at=now()
  WHERE id=p_release_id;

  IF v_charge_major>0 THEN
    INSERT INTO public.band_earnings
      (band_id,amount,source,description,earned_by_user_id,metadata)
    VALUES
      (v_release.band_id,v_charge_major::integer,'release_cancellation_refund',
       'Cancelled pre-release production: '||v_release.title,v_uid,
       jsonb_build_object('release_id',p_release_id,'operation','cancel_release_atomic',
         'verified_receipt_minor',v_band_cost_minor,'refund_major',v_charge_major))
    RETURNING id INTO v_refund_id;
  END IF;

  RETURN jsonb_build_object('success',true,'idempotent',false,
    'refundMajor',v_charge_major,'refundEarningId',v_refund_id,
    'releaseId',p_release_id);
END;
$cancel$;

-- New SECURITY DEFINER functions default to PUBLIC EXECUTE; remove it.
REVOKE ALL ON FUNCTION public.cancel_release_atomic(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_release_atomic(uuid)
  TO authenticated;
COMMIT;
