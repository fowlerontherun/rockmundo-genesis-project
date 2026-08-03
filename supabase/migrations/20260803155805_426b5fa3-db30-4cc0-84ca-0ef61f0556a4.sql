
-- =========================================================
-- Festival artist workflow RPCs (Phase 4B)
-- =========================================================

CREATE OR REPLACE FUNCTION public._festival_artist_identity(p_type text, p_profile uuid, p_band uuid, p_npc uuid)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',p_profile)
    WHEN 'band' THEN jsonb_build_object('type','band','bandId',p_band)
    ELSE jsonb_build_object('type','npc','npcArtistId',p_npc)
  END;
$$;

CREATE OR REPLACE FUNCTION public._festival_artist_programme_company(p_programme uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT festival_company_id FROM public.festival_artist_programmes WHERE id = p_programme;
$$;

CREATE OR REPLACE FUNCTION public._festival_artist_managed_bands(p_profile uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT b.id), '{}'::uuid[])
  FROM public.bands b
  LEFT JOIN public.band_members m ON m.band_id = b.id AND m.profile_id = p_profile
  WHERE b.leader_id = p_profile OR m.id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._festival_artist_audit(
  p_company uuid, p_entity_type text, p_entity_id uuid, p_event text,
  p_previous jsonb, p_new jsonb, p_version integer,
  p_artist_type text DEFAULT NULL, p_artist_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.festival_artist_plan_audit(
    festival_company_id, actor_profile_id, target_artist_type, target_artist_id,
    entity_type, entity_id, event_type, previous_state, new_state, changed_fields, version)
  VALUES (p_company, public.current_profile_id(), p_artist_type, p_artist_id,
    p_entity_type, p_entity_id, p_event, p_previous, p_new, '{}'::jsonb, GREATEST(COALESCE(p_version,1),1));
$$;

-- ---------------------------------------------------------
-- Player-facing: opportunities
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_festival_artist_opportunities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_bands uuid[];
  v_result jsonb;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  v_bands := public._festival_artist_managed_bands(v_profile);

  SELECT jsonb_build_object(
    'openApplications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'windowId', w.id,
        'festivalCompanyId', pr.festival_company_id,
        'name', w.name,
        'opensAt', w.opens_at,
        'closesAt', w.closes_at,
        'eligibleArtistType', w.eligible_artist_type,
        'minimumFame', w.minimum_fame,
        'maximumFame', w.maximum_fame,
        'preferredGenres', to_jsonb(w.preferred_genres),
        'stageTypes', to_jsonb(w.target_stage_types),
        'canApply', true))
      FROM public.festival_artist_application_windows w
      JOIN public.festival_artist_programmes pr ON pr.id = w.festival_artist_programme_id
      WHERE w.active AND now() BETWEEN w.opens_at AND w.closes_at
        AND pr.application_mode IN ('applications_only','hybrid')
    ), '[]'::jsonb),
    'applications', COALESCE((
      SELECT jsonb_agg(to_jsonb(a)) FROM public.festival_artist_applications a
      WHERE a.artist_profile_id = v_profile OR a.band_id = ANY(v_bands)
    ), '[]'::jsonb),
    'invitations', COALESCE((
      SELECT jsonb_agg(to_jsonb(i)) FROM public.festival_artist_invitations i
      WHERE i.artist_profile_id = v_profile OR i.band_id = ANY(v_bands)
    ), '[]'::jsonb),
    'offers', COALESCE((
      SELECT jsonb_agg(to_jsonb(o)) FROM public.festival_artist_offers o
      WHERE (o.artist_profile_id = v_profile OR o.band_id = ANY(v_bands)) AND o.status <> 'draft'
    ), '[]'::jsonb),
    'bookings', COALESCE((
      SELECT jsonb_agg(to_jsonb(b)) FROM public.festival_artist_bookings b
      WHERE b.artist_profile_id = v_profile OR b.band_id = ANY(v_bands)
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'profileId', v_profile,
      'canApplySolo', true,
      'managedBandIds', to_jsonb(v_bands))
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------
-- Owner-facing: candidate search
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_festival_artist_candidates(
  p_festival_company_id uuid,
  p_query text DEFAULT NULL,
  p_artist_type text DEFAULT NULL,
  p_genres text[] DEFAULT '{}',
  p_minimum_fame integer DEFAULT NULL,
  p_maximum_fame integer DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit,25),1),100);
  v_offset integer := GREATEST(COALESCE(p_offset,0),0);
  v_items jsonb;
BEGIN
  IF v_profile IS NULL OR NOT public._festival_artist_manager(p_festival_company_id, v_profile) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'fame')::int DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'identity', jsonb_build_object('type','band','bandId', b.id),
      'displayName', b.name,
      'playerNpc', 'player',
      'genres', to_jsonb(ARRAY[COALESCE(b.primary_genre, b.genre, 'unknown')]::text[]),
      'fame', GREATEST(COALESCE(b.fame,0),0)::int,
      'popularity', GREATEST(COALESCE(b.popularity,0),0)::int,
      'homeCity', NULL,
      'estimatedFeeMinimumMinor', GREATEST(COALESCE(b.fame,0),0)::bigint * 100,
      'estimatedFeeMaximumMinor', GREATEST(COALESCE(b.fame,0),0)::bigint * 400 + 50000,
      'availabilityState', 'unknown',
      'stageSuitability', 50,
      'genreFit', 50,
      'audienceFit', 50,
      'relationshipState', 'neutral') AS x
    FROM public.bands b
    WHERE b.status = 'active'
      AND (p_artist_type IS NULL OR p_artist_type IN ('band','either'))
      AND (p_query IS NULL OR b.name ILIKE '%'||p_query||'%')
      AND (COALESCE(array_length(p_genres,1),0) = 0 OR COALESCE(b.primary_genre, b.genre) = ANY(p_genres))
      AND (p_minimum_fame IS NULL OR COALESCE(b.fame,0) >= p_minimum_fame)
      AND (p_maximum_fame IS NULL OR COALESCE(b.fame,0) <= p_maximum_fame)
    ORDER BY COALESCE(b.fame,0) DESC
    LIMIT v_limit OFFSET v_offset
  ) s;

  RETURN jsonb_build_object('items', v_items, 'limit', v_limit, 'offset', v_offset);
END;
$$;

-- ---------------------------------------------------------
-- Applications
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_festival_artist_application(
  p_festival_company_id uuid,
  p_application_window_id uuid,
  p_artist_type text,
  p_artist_profile_id uuid DEFAULT NULL,
  p_band_id uuid DEFAULT NULL,
  p_preferred_dates date[] DEFAULT '{}',
  p_preferred_stage_types text[] DEFAULT '{}',
  p_minimum_fee_minor bigint DEFAULT 0,
  p_requested_fee_minor bigint DEFAULT 0,
  p_minimum_set_minutes integer DEFAULT 30,
  p_maximum_set_minutes integer DEFAULT 60,
  p_message text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_window public.festival_artist_application_windows;
  v_programme public.festival_artist_programmes;
  v_row public.festival_artist_applications;
  v_prior jsonb;
  v_fame integer := 0;
  v_genres text[] := '{}';
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;

  SELECT result INTO v_prior FROM public.festival_artist_plan_requests
  WHERE idempotency_key = p_idempotency_key AND status = 'completed';
  IF v_prior IS NOT NULL THEN RETURN v_prior; END IF;

  SELECT * INTO v_window FROM public.festival_artist_application_windows WHERE id = p_application_window_id;
  IF v_window.id IS NULL THEN RAISE EXCEPTION 'festival_artist_application_window_invalid'; END IF;
  SELECT * INTO v_programme FROM public.festival_artist_programmes WHERE id = v_window.festival_artist_programme_id;
  IF v_programme.festival_company_id <> p_festival_company_id THEN RAISE EXCEPTION 'festival_artist_application_window_invalid'; END IF;
  IF NOT v_window.active OR now() < v_window.opens_at OR now() > v_window.closes_at THEN
    RAISE EXCEPTION 'festival_artist_applications_closed';
  END IF;

  IF p_artist_type = 'band' THEN
    IF p_band_id IS NULL OR NOT public.caller_can_act_for_band(p_band_id) THEN
      RAISE EXCEPTION 'festival_artist_application_forbidden';
    END IF;
    SELECT COALESCE(fame,0), ARRAY[COALESCE(primary_genre, genre, 'unknown')]::text[]
      INTO v_fame, v_genres FROM public.bands WHERE id = p_band_id;
  ELSIF p_artist_type = 'solo' THEN
    IF COALESCE(p_artist_profile_id, v_profile) <> v_profile THEN
      RAISE EXCEPTION 'festival_artist_application_forbidden';
    END IF;
    p_artist_profile_id := v_profile;
    SELECT COALESCE(fame,0) INTO v_fame FROM public.profiles WHERE id = v_profile;
  ELSE
    RAISE EXCEPTION 'festival_artist_application_forbidden';
  END IF;

  IF v_window.minimum_fame IS NOT NULL AND v_fame < v_window.minimum_fame THEN RAISE EXCEPTION 'festival_artist_not_eligible'; END IF;
  IF v_window.maximum_fame IS NOT NULL AND v_fame > v_window.maximum_fame THEN RAISE EXCEPTION 'festival_artist_not_eligible'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.festival_artist_applications a
    WHERE a.application_window_id = p_application_window_id
      AND a.status NOT IN ('withdrawn','rejected','expired')
      AND ((p_band_id IS NOT NULL AND a.band_id = p_band_id)
        OR (p_band_id IS NULL AND a.artist_profile_id = p_artist_profile_id))
  ) THEN RAISE EXCEPTION 'festival_artist_application_duplicate'; END IF;

  INSERT INTO public.festival_artist_applications(
    festival_artist_programme_id, application_window_id, artist_type, artist_profile_id, band_id,
    submitted_by_profile_id, status, preferred_dates, preferred_stage_types,
    minimum_fee_minor, requested_fee_minor, minimum_set_minutes, maximum_set_minutes,
    genre_snapshot, fame_snapshot, popularity_snapshot, availability_snapshot, message)
  VALUES (v_programme.id, p_application_window_id, p_artist_type,
    CASE WHEN p_artist_type='solo' THEN p_artist_profile_id END,
    CASE WHEN p_artist_type='band' THEN p_band_id END,
    v_profile, 'submitted', COALESCE(p_preferred_dates,'{}'), COALESCE(p_preferred_stage_types,'{}'),
    GREATEST(COALESCE(p_minimum_fee_minor,0),0), GREATEST(COALESCE(p_requested_fee_minor,0),0),
    GREATEST(COALESCE(p_minimum_set_minutes,30),5), GREATEST(COALESCE(p_maximum_set_minutes,60),5),
    COALESCE(v_genres,'{}'), v_fame, v_fame, '{}'::jsonb, p_message)
  RETURNING * INTO v_row;

  PERFORM public._festival_artist_audit(p_festival_company_id,'application',v_row.id,'submitted',NULL,to_jsonb(v_row),v_row.version,p_artist_type,COALESCE(p_band_id,p_artist_profile_id));

  v_prior := jsonb_build_object('kind','application','application',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (p_festival_company_id, v_profile, v_row.id, 'submit_application', p_idempotency_key, md5(p_application_window_id::text), v_prior, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_prior;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_festival_artist_application(
  p_application_id uuid, p_expected_version integer DEFAULT NULL, p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_applications;
  v_company uuid;
  v_result jsonb;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key = p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT * INTO v_row FROM public.festival_artist_applications WHERE id = p_application_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_APPLICATION_NOT_FOUND'; END IF;
  IF NOT (v_row.artist_profile_id = v_profile OR (v_row.band_id IS NOT NULL AND public.caller_can_act_for_band(v_row.band_id))) THEN
    RAISE EXCEPTION 'festival_artist_application_forbidden';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN
    RAISE EXCEPTION 'FESTIVAL_APPLICATION_VERSION_CONFLICT';
  END IF;
  IF v_row.status NOT IN ('submitted','under_review','shortlisted') THEN
    RAISE EXCEPTION 'festival_artist_application_invalid_transition';
  END IF;

  UPDATE public.festival_artist_applications
     SET status='withdrawn', withdrawn_at=now(), version=version+1, updated_at=now()
   WHERE id = p_application_id RETURNING * INTO v_row;

  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  PERFORM public._festival_artist_audit(v_company,'application',v_row.id,'withdrawn',NULL,to_jsonb(v_row),v_row.version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
  v_result := jsonb_build_object('kind','application','application',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'withdraw_application', p_idempotency_key, md5(p_application_id::text), v_result, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_festival_artist_application(
  p_application_id uuid, p_status text, p_expected_version integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_applications;
  v_company uuid;
  v_result jsonb;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF p_status NOT IN ('under_review','shortlisted','offer_pending','rejected') THEN
    RAISE EXCEPTION 'festival_artist_application_invalid_transition';
  END IF;

  SELECT * INTO v_row FROM public.festival_artist_applications WHERE id=p_application_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_APPLICATION_NOT_FOUND'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  IF NOT public._festival_artist_manager(v_company, v_profile) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN RAISE EXCEPTION 'FESTIVAL_APPLICATION_VERSION_CONFLICT'; END IF;
  IF v_row.status IN ('withdrawn','accepted','expired') THEN RAISE EXCEPTION 'festival_artist_application_invalid_transition'; END IF;

  UPDATE public.festival_artist_applications
     SET status=p_status, reviewed_at=now(), version=version+1, updated_at=now()
   WHERE id=p_application_id RETURNING * INTO v_row;

  PERFORM public._festival_artist_audit(v_company,'application',v_row.id,'reviewed',NULL,to_jsonb(v_row),v_row.version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
  v_result := jsonb_build_object('kind','application','application',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'review_application', p_idempotency_key, md5(p_application_id::text||p_status), v_result, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_festival_artist_invitation(
  p_festival_company_id uuid, p_artist_type text,
  p_artist_profile_id uuid DEFAULT NULL, p_band_id uuid DEFAULT NULL, p_npc_artist_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL, p_suggested_fee_minor bigint DEFAULT NULL, p_suggested_set_minutes integer DEFAULT NULL,
  p_suggested_dates date[] DEFAULT '{}', p_suggested_stage_types text[] DEFAULT '{}',
  p_expires_at timestamptz DEFAULT NULL, p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_programme uuid;
  v_row public.festival_artist_invitations;
  v_result jsonb;
BEGIN
  IF v_profile IS NULL OR NOT public._festival_artist_manager(p_festival_company_id, v_profile) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT id INTO v_programme FROM public.festival_artist_programmes WHERE festival_company_id=p_festival_company_id;
  IF v_programme IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;

  IF EXISTS (SELECT 1 FROM public.festival_artist_invitations i
             WHERE i.festival_artist_programme_id=v_programme
               AND i.status IN ('draft','sent','viewed','interested')
               AND ((p_band_id IS NOT NULL AND i.band_id=p_band_id)
                 OR (p_artist_profile_id IS NOT NULL AND i.artist_profile_id=p_artist_profile_id)
                 OR (p_npc_artist_id IS NOT NULL AND i.npc_artist_id=p_npc_artist_id)))
  THEN RAISE EXCEPTION 'festival_artist_invitation_duplicate'; END IF;

  INSERT INTO public.festival_artist_invitations(
    festival_artist_programme_id, artist_type, artist_profile_id, band_id, npc_artist_id,
    invited_by_profile_id, status, message, suggested_fee_minor, suggested_set_minutes,
    suggested_dates, suggested_stage_types, expires_at)
  VALUES (v_programme, p_artist_type, p_artist_profile_id, p_band_id, p_npc_artist_id,
    v_profile, 'sent', p_message, p_suggested_fee_minor, p_suggested_set_minutes,
    COALESCE(p_suggested_dates,'{}'), COALESCE(p_suggested_stage_types,'{}'), p_expires_at)
  RETURNING * INTO v_row;

  PERFORM public._festival_artist_audit(p_festival_company_id,'invitation',v_row.id,'sent',NULL,to_jsonb(v_row),v_row.version,p_artist_type,COALESCE(p_band_id,p_artist_profile_id,p_npc_artist_id));
  v_result := jsonb_build_object('kind','invitation','invitation',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (p_festival_company_id, v_profile, v_row.id, 'send_invitation', p_idempotency_key, md5(COALESCE(p_band_id,p_artist_profile_id,p_npc_artist_id)::text), v_result, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_festival_artist_invitation(
  p_invitation_id uuid, p_response text, p_expected_version integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_invitations;
  v_company uuid;
  v_result jsonb;
  v_status text;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  v_status := CASE lower(COALESCE(p_response,'')) WHEN 'accept' THEN 'interested' WHEN 'interested' THEN 'interested'
                                                  WHEN 'decline' THEN 'declined' WHEN 'declined' THEN 'declined' ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'festival_artist_invitation_invalid_transition'; END IF;

  SELECT * INTO v_row FROM public.festival_artist_invitations WHERE id=p_invitation_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_INVITATION_NOT_FOUND'; END IF;
  IF NOT (v_row.artist_profile_id = v_profile OR (v_row.band_id IS NOT NULL AND public.caller_can_act_for_band(v_row.band_id))) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status NOT IN ('sent','viewed') THEN RAISE EXCEPTION 'FESTIVAL_INVITATION_ALREADY_RESPONDED'; END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN RAISE EXCEPTION 'FESTIVAL_INVITATION_EXPIRED'; END IF;

  UPDATE public.festival_artist_invitations
     SET status=v_status, responded_at=now(), version=version+1
   WHERE id=p_invitation_id RETURNING * INTO v_row;

  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  PERFORM public._festival_artist_audit(v_company,'invitation',v_row.id,'responded',NULL,to_jsonb(v_row),v_row.version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
  v_result := jsonb_build_object('kind','invitation','invitation',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'respond_invitation', p_idempotency_key, md5(p_invitation_id::text||v_status), v_result, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------
-- Offers
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_festival_artist_offer(
  p_festival_company_id uuid, p_artist_type text,
  p_artist_profile_id uuid DEFAULT NULL, p_band_id uuid DEFAULT NULL, p_npc_artist_id uuid DEFAULT NULL,
  p_application_id uuid DEFAULT NULL, p_invitation_id uuid DEFAULT NULL,
  p_offered_fee_minor bigint DEFAULT 0, p_set_minutes integer DEFAULT 45,
  p_billing_position text DEFAULT 'support', p_preferred_date date DEFAULT NULL,
  p_preferred_stage_id uuid DEFAULT NULL, p_travel_support_minor bigint DEFAULT 0,
  p_accommodation_support_minor bigint DEFAULT 0, p_response_deadline timestamptz DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_programme public.festival_artist_programmes;
  v_row public.festival_artist_offers;
  v_committed bigint;
  v_total bigint;
  v_result jsonb;
BEGIN
  IF v_profile IS NULL OR NOT public._festival_artist_manager(p_festival_company_id, v_profile) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT * INTO v_programme FROM public.festival_artist_programmes WHERE festival_company_id=p_festival_company_id;
  IF v_programme.id IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;

  v_total := GREATEST(COALESCE(p_offered_fee_minor,0),0) + GREATEST(COALESCE(p_travel_support_minor,0),0) + GREATEST(COALESCE(p_accommodation_support_minor,0),0);
  SELECT COALESCE(SUM(amount_minor),0) INTO v_committed
    FROM public.festival_financial_commitments
   WHERE festival_company_id=p_festival_company_id AND status='committed';
  IF v_committed + v_total > v_programme.artist_budget_minor + v_programme.contingency_budget_minor THEN
    RAISE EXCEPTION 'festival_artist_offer_budget_exceeded';
  END IF;

  INSERT INTO public.festival_artist_offers(
    festival_artist_programme_id, application_id, invitation_id, artist_type,
    artist_profile_id, band_id, npc_artist_id, status, offered_fee_minor, currency_code,
    set_minutes, performance_count, preferred_date, preferred_stage_id, billing_position,
    travel_support_minor, accommodation_support_minor, merch_revenue_share_basis_points,
    response_deadline, offer_version, created_by_profile_id)
  VALUES (v_programme.id, p_application_id, p_invitation_id, p_artist_type,
    p_artist_profile_id, p_band_id, p_npc_artist_id, 'draft', GREATEST(COALESCE(p_offered_fee_minor,0),0),
    v_programme.currency_code, GREATEST(COALESCE(p_set_minutes,45),5), 1, p_preferred_date, p_preferred_stage_id,
    COALESCE(p_billing_position,'support'), GREATEST(COALESCE(p_travel_support_minor,0),0),
    GREATEST(COALESCE(p_accommodation_support_minor,0),0), 0, p_response_deadline, 1, v_profile)
  RETURNING * INTO v_row;

  INSERT INTO public.festival_artist_offer_revisions(
    offer_id, offer_version, proposed_by_party, proposed_by_profile_id, fee_minor, set_minutes,
    preferred_date, preferred_stage_id, billing_position, travel_support_minor,
    accommodation_support_minor, merch_revenue_share_basis_points, terms_snapshot)
  VALUES (v_row.id, 1, 'festival', v_profile, v_row.offered_fee_minor, v_row.set_minutes,
    v_row.preferred_date, v_row.preferred_stage_id, v_row.billing_position, v_row.travel_support_minor,
    v_row.accommodation_support_minor, 0, to_jsonb(v_row));

  PERFORM public._festival_artist_audit(p_festival_company_id,'offer',v_row.id,'created',NULL,to_jsonb(v_row),v_row.offer_version,p_artist_type,COALESCE(p_band_id,p_artist_profile_id,p_npc_artist_id));
  v_result := jsonb_build_object('kind','offer','offer',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (p_festival_company_id, v_profile, v_row.id, 'create_offer', p_idempotency_key, md5(v_row.id::text), v_result, 'completed', now())
  ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_festival_artist_offer(
  p_offer_id uuid, p_expected_version integer DEFAULT NULL, p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_offers; v_company uuid; v_result jsonb;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_row FROM public.festival_artist_offers WHERE id=p_offer_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  IF NOT public._festival_artist_manager(v_company, v_profile) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.offer_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status NOT IN ('draft','countered') THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;

  UPDATE public.festival_artist_offers SET status='sent', updated_at=now() WHERE id=p_offer_id RETURNING * INTO v_row;
  PERFORM public._festival_artist_audit(v_company,'offer',v_row.id,'sent',NULL,to_jsonb(v_row),v_row.offer_version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id,v_row.npc_artist_id));
  v_result := jsonb_build_object('kind','offer','offer',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'send_offer', p_idempotency_key, md5(p_offer_id::text), v_result, 'completed', now()) ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.counter_festival_artist_offer(
  p_offer_id uuid, p_fee_minor bigint, p_set_minutes integer DEFAULT NULL,
  p_message text DEFAULT NULL, p_expected_version integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_offers; v_company uuid; v_result jsonb;
  v_is_manager boolean; v_is_artist boolean; v_party text;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_row FROM public.festival_artist_offers WHERE id=p_offer_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  v_is_manager := public._festival_artist_manager(v_company, v_profile);
  v_is_artist := v_row.artist_profile_id = v_profile OR (v_row.band_id IS NOT NULL AND public.caller_can_act_for_band(v_row.band_id));
  IF NOT (v_is_manager OR v_is_artist) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.offer_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status NOT IN ('sent','countered') THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  v_party := CASE WHEN v_is_manager THEN 'festival' ELSE 'artist' END;

  UPDATE public.festival_artist_offers
     SET status='countered', offered_fee_minor=GREATEST(COALESCE(p_fee_minor, offered_fee_minor),0),
         set_minutes=GREATEST(COALESCE(p_set_minutes,set_minutes),5),
         offer_version=offer_version+1, updated_at=now()
   WHERE id=p_offer_id RETURNING * INTO v_row;

  INSERT INTO public.festival_artist_offer_revisions(
    offer_id, offer_version, proposed_by_party, proposed_by_profile_id, fee_minor, set_minutes,
    preferred_date, preferred_stage_id, billing_position, travel_support_minor,
    accommodation_support_minor, merch_revenue_share_basis_points, terms_snapshot, message)
  VALUES (v_row.id, v_row.offer_version, v_party, v_profile, v_row.offered_fee_minor, v_row.set_minutes,
    v_row.preferred_date, v_row.preferred_stage_id, v_row.billing_position, v_row.travel_support_minor,
    v_row.accommodation_support_minor, v_row.merch_revenue_share_basis_points, to_jsonb(v_row), p_message);

  PERFORM public._festival_artist_audit(v_company,'offer',v_row.id,'countered',NULL,to_jsonb(v_row),v_row.offer_version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id,v_row.npc_artist_id));
  v_result := jsonb_build_object('kind','offer','offer',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'counter_offer', p_idempotency_key, md5(p_offer_id::text), v_result, 'completed', now()) ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_festival_artist_offer(
  p_offer_id uuid, p_expected_version integer DEFAULT NULL, p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_offers; v_company uuid; v_result jsonb;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_row FROM public.festival_artist_offers WHERE id=p_offer_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  IF NOT public._festival_artist_manager(v_company, v_profile) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.offer_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status IN ('accepted','withdrawn') THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;

  UPDATE public.festival_artist_offers SET status='withdrawn', cancelled_at=now(), updated_at=now()
   WHERE id=p_offer_id RETURNING * INTO v_row;
  PERFORM public._festival_artist_audit(v_company,'offer',v_row.id,'withdrawn',NULL,to_jsonb(v_row),v_row.offer_version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id,v_row.npc_artist_id));
  v_result := jsonb_build_object('kind','offer','offer',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'withdraw_offer', p_idempotency_key, md5(p_offer_id::text), v_result, 'completed', now()) ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_festival_artist_offer(
  p_offer_id uuid, p_response text, p_expected_version integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_offers; v_company uuid; v_result jsonb;
  v_booking public.festival_artist_bookings; v_total bigint; v_commitment public.festival_financial_commitments;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF lower(COALESCE(p_response,'')) NOT IN ('accept','decline') THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;

  SELECT * INTO v_row FROM public.festival_artist_offers WHERE id=p_offer_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  IF NOT (v_row.artist_profile_id = v_profile OR (v_row.band_id IS NOT NULL AND public.caller_can_act_for_band(v_row.band_id))) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.offer_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status NOT IN ('sent','countered') THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);

  IF lower(p_response) = 'decline' THEN
    UPDATE public.festival_artist_offers SET status='declined', declined_at=now(), updated_at=now()
     WHERE id=p_offer_id RETURNING * INTO v_row;
    PERFORM public._festival_artist_audit(v_company,'offer',v_row.id,'declined',NULL,to_jsonb(v_row),v_row.offer_version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
    v_result := jsonb_build_object('kind','offer','offer',to_jsonb(v_row));
  ELSE
    UPDATE public.festival_artist_offers SET status='accepted', accepted_at=now(), updated_at=now()
     WHERE id=p_offer_id RETURNING * INTO v_row;
    v_total := v_row.offered_fee_minor + v_row.travel_support_minor + v_row.accommodation_support_minor;

    INSERT INTO public.festival_artist_bookings(
      festival_artist_programme_id, offer_id, artist_type, artist_profile_id, band_id, npc_artist_id,
      status, agreed_fee_minor, travel_support_minor, accommodation_support_minor, total_commitment_minor,
      currency_code, set_minutes, performance_count, provisional_date, provisional_stage_id,
      billing_position, contract_terms, confirmed_at)
    VALUES (v_row.festival_artist_programme_id, v_row.id, v_row.artist_type, v_row.artist_profile_id,
      v_row.band_id, v_row.npc_artist_id, 'confirmed', v_row.offered_fee_minor, v_row.travel_support_minor,
      v_row.accommodation_support_minor, v_total, v_row.currency_code, v_row.set_minutes,
      v_row.performance_count, v_row.preferred_date, v_row.preferred_stage_id,
      v_row.billing_position, to_jsonb(v_row), now())
    RETURNING * INTO v_booking;

    INSERT INTO public.festival_financial_commitments(
      festival_company_id, artist_booking_id, category, amount_minor, currency_code, status)
    VALUES (v_company, v_booking.id, 'artist_fee', v_total, v_row.currency_code, 'committed')
    RETURNING * INTO v_commitment;

    IF v_row.application_id IS NOT NULL THEN
      UPDATE public.festival_artist_applications SET status='accepted', version=version+1, updated_at=now()
       WHERE id=v_row.application_id;
    END IF;

    PERFORM public._festival_artist_audit(v_company,'booking',v_booking.id,'confirmed',NULL,to_jsonb(v_booking),1,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
    v_result := jsonb_build_object('kind','booking','booking',to_jsonb(v_booking),'offer',to_jsonb(v_row),
      'commitment', jsonb_build_object('id',v_commitment.id,'amount_minor',v_commitment.amount_minor,'currency_code',v_commitment.currency_code,'status',v_commitment.status));
  END IF;

  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'respond_offer', p_idempotency_key, md5(p_offer_id::text||lower(p_response)), v_result, 'completed', now()) ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_festival_artist_booking(
  p_booking_id uuid, p_reason text DEFAULT NULL, p_expected_version integer DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_row public.festival_artist_bookings; v_company uuid; v_result jsonb;
  v_is_manager boolean; v_is_artist boolean;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  SELECT result INTO v_result FROM public.festival_artist_plan_requests WHERE idempotency_key=p_idempotency_key AND status='completed';
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_row FROM public.festival_artist_bookings WHERE id=p_booking_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'festival_artist_booking_invalid_transition'; END IF;
  v_company := public._festival_artist_programme_company(v_row.festival_artist_programme_id);
  v_is_manager := public._festival_artist_manager(v_company, v_profile);
  v_is_artist := v_row.artist_profile_id = v_profile OR (v_row.band_id IS NOT NULL AND public.caller_can_act_for_band(v_row.band_id));
  IF NOT (v_is_manager OR v_is_artist) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_row.version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
  IF v_row.status IN ('cancelled','artist_withdrawn','festival_cancelled') THEN RAISE EXCEPTION 'festival_artist_booking_invalid_transition'; END IF;

  UPDATE public.festival_artist_bookings
     SET status = CASE WHEN v_is_manager THEN 'festival_cancelled' ELSE 'artist_withdrawn' END,
         cancelled_at=now(), version=version+1, updated_at=now()
   WHERE id=p_booking_id RETURNING * INTO v_row;

  UPDATE public.festival_financial_commitments
     SET status='released', released_at=now()
   WHERE artist_booking_id=p_booking_id AND status='committed';

  PERFORM public._festival_artist_audit(v_company,'booking',v_row.id,'cancelled',NULL,to_jsonb(v_row),v_row.version,v_row.artist_type,COALESCE(v_row.band_id,v_row.artist_profile_id));
  v_result := jsonb_build_object('kind','booking','booking',to_jsonb(v_row));
  INSERT INTO public.festival_artist_plan_requests(festival_company_id, caller_profile_id, target_entity_id, action, idempotency_key, payload_hash, result, status, completed_at)
  VALUES (v_company, v_profile, v_row.id, 'cancel_booking', p_idempotency_key, md5(p_booking_id::text||COALESCE(p_reason,'')), v_result, 'completed', now()) ON CONFLICT DO NOTHING;
  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------
-- Execution grants (authenticated callers only; RPCs enforce authority)
-- ---------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_my_festival_artist_opportunities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_festival_artist_candidates(uuid,text,text,text[],integer,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_festival_artist_application(uuid,uuid,text,uuid,uuid,date[],text[],bigint,bigint,integer,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_festival_artist_application(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_festival_artist_application(uuid,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_festival_artist_invitation(uuid,text,uuid,uuid,uuid,text,bigint,integer,date[],text[],timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_festival_artist_invitation(uuid,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_artist_offer(uuid,text,uuid,uuid,uuid,uuid,uuid,bigint,integer,text,date,uuid,bigint,bigint,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_festival_artist_offer(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.counter_festival_artist_offer(uuid,bigint,integer,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_festival_artist_offer(uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_festival_artist_offer(uuid,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_festival_artist_booking(uuid,text,integer,uuid) TO authenticated;
