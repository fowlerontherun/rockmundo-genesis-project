-- Do not reuse the previous edition's completed dates when starting the next year.
-- Preserve the existing owner authorization and idempotency contract.
CREATE OR REPLACE FUNCTION public._festival_plan_edition(
  p_festival_company_id uuid, p_idempotency_key text, p_payload_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_fc public.festival_companies%ROWTYPE;
  v_cfg public.festival_configurations%ROWTYPE;
  v_req public.festival_edition_plan_requests%ROWTYPE;
  v_year int;
  v_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_fc FROM public.festival_companies WHERE id=p_festival_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  -- The owner may switch between living profiles on the same account.
  -- Check the immutable account owner rather than only the selected profile.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles owner_profile
    WHERE owner_profile.id = v_fc.owner_profile_id
      AND owner_profile.user_id = auth.uid()
      AND owner_profile.died_at IS NULL
  ) AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001';
  END IF;
  IF v_fc.status <> 'active' OR NOT v_fc.setup_completed THEN
    RAISE EXCEPTION 'festival_company_not_ready' USING ERRCODE='P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text,0));
  SELECT * INTO v_req FROM public.festival_edition_plan_requests
    WHERE festival_company_id=p_festival_company_id AND caller_profile_id=v_profile
      AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status='succeeded' THEN RETURN v_req.result || jsonb_build_object('idempotent',true); END IF;
  ELSE
    INSERT INTO public.festival_edition_plan_requests(festival_company_id,caller_profile_id,idempotency_key,payload_hash)
    VALUES(p_festival_company_id,v_profile,p_idempotency_key,p_payload_hash) RETURNING * INTO v_req;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.festival_editions_v2 WHERE festival_company_id=p_festival_company_id
      AND locked_at IS NULL AND status NOT IN ('completed','cancelled')
  ) THEN RAISE EXCEPTION 'festival_edition_already_open' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_cfg FROM public.festival_configurations WHERE festival_company_id=p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_configuration_incomplete' USING ERRCODE='P0001'; END IF;
  SELECT greatest(public.rockmundo_game_year(),coalesce(max(edition_year)+1,public.rockmundo_game_year()))
    INTO v_year FROM public.festival_editions_v2 WHERE festival_company_id=p_festival_company_id;
  INSERT INTO public.festival_editions_v2(
    festival_company_id,edition_year,name,status,starts_on,ends_on,
    country_code,city_id,vibe,site_type,duration_days,environmental_policy,preferred_month,creation_source
  ) VALUES(
    p_festival_company_id,v_year,
    coalesce(nullif(btrim(coalesce(v_cfg.public_name,'')),''),v_fc.public_name)||' '||v_year,
    'draft',NULL,NULL,v_fc.country_code,v_cfg.home_city_id,v_fc.default_vibe,
    v_fc.default_site_type,coalesce(v_cfg.duration_days,v_fc.default_duration_days),
    v_fc.environmental_policy,v_fc.annual_month,'next_annual'
  ) RETURNING id INTO v_id;
  v_result:=jsonb_build_object('festivalCompanyId',p_festival_company_id,
    'festivalEditionId',v_id,'editionYear',v_year,'status','draft','idempotent',false);
  UPDATE public.festival_edition_plan_requests SET status='succeeded',result=v_result,updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.festival_company_audit_log(
    festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata
  ) VALUES(p_festival_company_id,v_fc.company_id,v_profile,'festival_edition_planned',
    p_idempotency_key,jsonb_build_object('festival_edition_id',v_id,'edition_year',v_year));
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public._festival_plan_edition(uuid,text,text) FROM PUBLIC,anon,authenticated;

-- Annual-edition planning writes an audit event after creating the draft.
-- The founding-only constraint previously rejected that event and rolled back
-- the entire planning transaction.
ALTER TABLE public.festival_company_audit_log
  DROP CONSTRAINT IF EXISTS festival_company_audit_log_action_check;
ALTER TABLE public.festival_company_audit_log
  ADD CONSTRAINT festival_company_audit_log_action_check
  CHECK (action IN ('festival_company_founded', 'founding_fee_charged', 'festival_edition_planned'));
