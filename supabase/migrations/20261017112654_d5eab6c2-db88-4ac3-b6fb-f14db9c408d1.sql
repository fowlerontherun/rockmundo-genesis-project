CREATE OR REPLACE FUNCTION public.update_band_finance_policy(p_band_id uuid, p_profile_id uuid, p_changes jsonb)
RETURNS public.band_finance_policies LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.band_finance_policies; v_new public.band_finance_policies;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bands WHERE id = p_band_id AND leader_id = p_profile_id) THEN RAISE EXCEPTION 'Only the band leader can change finance rules'; END IF;
  INSERT INTO band_finance_policies (band_id) VALUES (p_band_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_old FROM band_finance_policies WHERE band_id = p_band_id FOR UPDATE;
  UPDATE band_finance_policies SET
    minimum_reserve_minor = greatest(0, coalesce((p_changes->>'minimum_reserve_minor')::bigint, minimum_reserve_minor)),
    member_withdrawals_allowed = coalesce((p_changes->>'member_withdrawals_allowed')::boolean, member_withdrawals_allowed),
    withdrawals_require_approval = coalesce((p_changes->>'withdrawals_require_approval')::boolean, withdrawals_require_approval),
    approval_threshold_minor = greatest(0, coalesce((p_changes->>'approval_threshold_minor')::bigint, approval_threshold_minor)),
    spending_approval_threshold_minor = greatest(0, coalesce((p_changes->>'spending_approval_threshold_minor')::bigint, spending_approval_threshold_minor)),
    revenue_split_method = coalesce((p_changes->>'revenue_split_method')::band_revenue_split_method, revenue_split_method),
    member_visibility_level = CASE WHEN p_changes->>'member_visibility_level' IN ('summary','detailed') THEN p_changes->>'member_visibility_level' ELSE member_visibility_level END,
    updated_by_profile_id = p_profile_id, updated_at = now()
  WHERE band_id = p_band_id RETURNING * INTO v_new;
  INSERT INTO finance_audit_events (actor_profile_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (p_profile_id, 'update_band_finance_policy', 'band', p_band_id, to_jsonb(v_old), to_jsonb(v_new));
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.submit_band_finance_request(p_band_id uuid, p_profile_id uuid, p_kind text, p_amount_minor bigint, p_reason text, p_category text DEFAULT 'other')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_policy band_finance_policies;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  IF NOT EXISTS (SELECT 1 FROM band_members WHERE band_id = p_band_id AND profile_id = p_profile_id) AND NOT EXISTS (SELECT 1 FROM bands WHERE id = p_band_id AND leader_id = p_profile_id) THEN RAISE EXCEPTION 'You are not in this band'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_amount_minor > 100000000 THEN RAISE EXCEPTION 'Enter an amount between $0.01 and $1,000,000'; END IF;
  IF coalesce(length(trim(p_reason)),0) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  SELECT * INTO v_policy FROM band_finance_policies WHERE band_id = p_band_id;
  IF p_kind = 'withdrawal' THEN
    IF NOT coalesce(v_policy.member_withdrawals_allowed,false) AND NOT EXISTS (SELECT 1 FROM bands WHERE id = p_band_id AND leader_id = p_profile_id) THEN RAISE EXCEPTION 'This band does not allow member withdrawals'; END IF;
    INSERT INTO band_withdrawal_requests (band_id, requesting_profile_id, amount_minor, reason, status, required_approvals)
    VALUES (p_band_id, p_profile_id, p_amount_minor, left(trim(p_reason),500), 'awaiting_approval', coalesce(v_policy.approvals_required_above_threshold,1)) RETURNING id INTO v_id;
  ELSIF p_kind = 'reimbursement' THEN
    IF NOT coalesce((v_policy.reimbursement_policy->>'enabled')::boolean, true) THEN RAISE EXCEPTION 'Expense refunds are switched off for this band'; END IF;
    INSERT INTO band_reimbursement_requests (band_id, profile_id, amount_minor, category, description, status)
    VALUES (p_band_id, p_profile_id, p_amount_minor, left(coalesce(nullif(trim(p_category),''),'other'),40), left(trim(p_reason),500), 'awaiting_approval') RETURNING id INTO v_id;
  ELSE RAISE EXCEPTION 'Unknown request type'; END IF;
  INSERT INTO finance_audit_events (actor_profile_id, action, entity_type, entity_id, new_value)
  VALUES (p_profile_id, 'submit_'||p_kind, p_kind, v_id, jsonb_build_object('amount_minor',p_amount_minor,'reason',p_reason));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_band_finance_request(p_profile_id uuid, p_kind text, p_request_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_band uuid; v_owner uuid; v_status text; v_is_leader boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  IF p_decision NOT IN ('approved','rejected','cancelled') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF p_kind = 'withdrawal' THEN SELECT band_id, requesting_profile_id, status::text INTO v_band, v_owner, v_status FROM band_withdrawal_requests WHERE id = p_request_id FOR UPDATE;
  ELSIF p_kind = 'reimbursement' THEN SELECT band_id, profile_id, status::text INTO v_band, v_owner, v_status FROM band_reimbursement_requests WHERE id = p_request_id FOR UPDATE;
  ELSE RAISE EXCEPTION 'Unknown request type'; END IF;
  IF v_band IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_status NOT IN ('submitted','awaiting_approval') THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
  v_is_leader := EXISTS (SELECT 1 FROM bands WHERE id = v_band AND leader_id = p_profile_id);
  IF p_decision = 'cancelled' AND v_owner <> p_profile_id THEN RAISE EXCEPTION 'Only the requester can cancel'; END IF;
  IF p_decision IN ('approved','rejected') AND NOT v_is_leader THEN RAISE EXCEPTION 'Only the band leader can decide requests'; END IF;
  IF p_decision = 'approved' AND v_owner = p_profile_id AND EXISTS (SELECT 1 FROM band_members WHERE band_id = v_band AND profile_id <> p_profile_id) THEN RAISE EXCEPTION 'You cannot approve your own request'; END IF;
  IF p_kind = 'withdrawal' THEN
    UPDATE band_withdrawal_requests SET status = p_decision::band_withdrawal_status, reviewed_at = now(), rejection_reason = CASE WHEN p_decision='rejected' THEN p_note END,
      approver_profile_ids = CASE WHEN p_decision='approved' THEN array_append(approver_profile_ids, p_profile_id) ELSE approver_profile_ids END, updated_at = now() WHERE id = p_request_id;
  ELSE
    UPDATE band_reimbursement_requests SET status = p_decision::reimbursement_status, approver_profile_id = CASE WHEN p_decision<>'cancelled' THEN p_profile_id END, updated_at = now() WHERE id = p_request_id;
  END IF;
  INSERT INTO finance_audit_events (actor_profile_id, action, entity_type, entity_id, previous_value, new_value, reason)
  VALUES (p_profile_id, p_decision||'_'||p_kind, p_kind, p_request_id, jsonb_build_object('status',v_status), jsonb_build_object('status',p_decision), p_note);
  RETURN p_decision;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_balance_version(p_version_key text, p_name text, p_description text, p_config jsonb, p_parent_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF coalesce(trim(p_version_key),'') = '' OR coalesce(trim(p_name),'') = '' THEN RAISE EXCEPTION 'Key and name are required'; END IF;
  IF jsonb_typeof(p_config) <> 'object' THEN RAISE EXCEPTION 'Settings must be a JSON object'; END IF;
  INSERT INTO balance_versions (version_key, name, description, config, parent_version_id, created_by)
  VALUES (trim(p_version_key), trim(p_name), p_description, p_config, p_parent_id, auth.uid()) RETURNING id INTO v_id;
  INSERT INTO balance_audit_log (balance_version_id, action, actor_id, change_summary) VALUES (v_id, 'create', auth.uid(), p_name);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_balance_version_status(p_version_id uuid, p_status public.balance_version_status, p_note text DEFAULT NULL)
RETURNS public.balance_version_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old balance_version_status;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT status INTO v_old FROM balance_versions WHERE id = p_version_id FOR UPDATE;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Version not found'; END IF;
  IF v_old IN ('retired','rolled_back') THEN RAISE EXCEPTION 'Retired versions cannot change status'; END IF;
  IF p_status = 'active' THEN
    IF v_old NOT IN ('approved','scheduled','valid') THEN RAISE EXCEPTION 'Approve a version before making it live'; END IF;
    UPDATE balance_versions SET status = 'retired', retired_at = now() WHERE status = 'active' AND id <> p_version_id;
    UPDATE balance_versions SET status = 'active', activated_at = now() WHERE id = p_version_id;
    INSERT INTO balance_rollouts (balance_version_id, status, activated_at, actor_id) VALUES (p_version_id, 'activated', now(), auth.uid());
  ELSE
    UPDATE balance_versions SET status = p_status,
      validated_at = CASE WHEN p_status IN ('valid','invalid') THEN now() ELSE validated_at END,
      retired_at = CASE WHEN p_status IN ('retired','rolled_back') THEN now() ELSE retired_at END WHERE id = p_version_id;
  END IF;
  INSERT INTO balance_audit_log (balance_version_id, action, actor_id, change_summary, metadata) VALUES (p_version_id, 'status:'||p_status, auth.uid(), p_note, jsonb_build_object('from', v_old));
  RETURN p_status;
END $$;

REVOKE ALL ON FUNCTION public.update_band_finance_policy(uuid,uuid,jsonb), public.submit_band_finance_request(uuid,uuid,text,bigint,text,text), public.review_band_finance_request(uuid,text,uuid,text,text), public.admin_create_balance_version(text,text,text,jsonb,uuid), public.admin_set_balance_version_status(uuid,public.balance_version_status,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_band_finance_policy(uuid,uuid,jsonb), public.submit_band_finance_request(uuid,uuid,text,bigint,text,text), public.review_band_finance_request(uuid,text,uuid,text,text), public.admin_create_balance_version(text,text,text,jsonb,uuid), public.admin_set_balance_version_status(uuid,public.balance_version_status,text) TO authenticated, service_role;