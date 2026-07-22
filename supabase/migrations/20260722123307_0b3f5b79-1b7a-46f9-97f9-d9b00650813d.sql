CREATE OR REPLACE FUNCTION public.purchase_festival_edition_insurance(p_quote_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL, p_edition_id uuid DEFAULT NULL, p_coverage_type text DEFAULT 'standard', p_premium_cents bigint DEFAULT NULL, p_payout_ceiling_cents bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_policy public.festival_insurance_policies%ROWTYPE;
  v_quote jsonb;
BEGIN
  IF p_edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: edition_id required'; END IF;
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  IF COALESCE(p_premium_cents, 0) = 0 THEN
    v_quote := public.quote_festival_edition_insurance(p_edition_id, 'RockMundo Mutual', p_coverage_type);
    p_premium_cents := COALESCE((v_quote->>'premiumCents')::bigint, (v_quote->>'premium_cents')::bigint);
    p_payout_ceiling_cents := COALESCE((v_quote->>'payoutCeilingCents')::bigint, (v_quote->>'payout_ceiling_cents')::bigint);
  END IF;
  UPDATE public.festival_insurance_policies SET active = false, updated_at = now() WHERE edition_id = p_edition_id AND coverage_type = p_coverage_type AND active = true;
  INSERT INTO public.festival_insurance_policies(festival_id, edition_id, coverage_type, premium_cents, payout_ceiling_cents, weather_rider, active, effective_from, effective_to)
  VALUES (v_edition.festival_id, v_edition.id, p_coverage_type, p_premium_cents, p_payout_ceiling_cents, p_coverage_type IN ('standard','premium'), true, COALESCE((v_edition.start_at AT TIME ZONE COALESCE(NULLIF(v_edition.timezone,''), 'UTC'))::date, CURRENT_DATE), COALESCE((v_edition.end_at AT TIME ZONE COALESCE(NULLIF(v_edition.timezone,''), 'UTC'))::date + 1, CURRENT_DATE + 1)) RETURNING * INTO v_policy;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
  VALUES (public.current_profile_id_safe(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_edition.festival_id, p_edition_id, 'purchase_insurance', 'insurance', v_policy.id, to_jsonb(v_policy), p_idempotency_key);
  RETURN to_jsonb(v_policy);
END $$;
GRANT EXECUTE ON FUNCTION public.purchase_festival_edition_insurance(uuid,text,uuid,text,bigint,bigint) TO authenticated;