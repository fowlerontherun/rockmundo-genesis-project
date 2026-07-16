-- Complete canonical festival booking workspace projections without adding performance or settlement behaviour.

CREATE OR REPLACE FUNCTION public.festival_represented_bands()
RETURNS TABLE(
  band_id uuid,
  band_name text,
  member_role text,
  member_status text,
  can_apply boolean,
  can_negotiate boolean,
  can_sign boolean,
  can_manage_bookings boolean,
  active_application_count bigint,
  active_festival_contract_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    b.id,
    b.name::text,
    bm.role::text,
    coalesce(bm.member_status, 'active')::text,
    public.can_apply_for_band(b.id, public.current_profile_id_safe()),
    public.can_negotiate_for_band(b.id, public.current_profile_id_safe()),
    public.can_sign_for_band(b.id, public.current_profile_id_safe()),
    public.can_manage_festival_booking(b.id, public.current_profile_id_safe()),
    (SELECT count(*) FROM public.festival_applications a WHERE a.band_id = b.id AND a.status IN ('draft','submitted','under_review','waitlisted','shortlisted','offer_pending')),
    (SELECT count(*) FROM public.festival_contracts c WHERE c.band_id = b.id AND c.status IN ('awaiting_band_signature','awaiting_organiser_signature','awaiting_signatures','active','amendment_required'))
  FROM public.band_members bm
  JOIN public.bands b ON b.id = bm.band_id
  WHERE bm.user_id = auth.uid()
    AND coalesce(bm.member_status, 'active') = 'active'
  ORDER BY lower(b.name), b.id;
$$;

CREATE OR REPLACE FUNCTION public.festival_application_eligibility(p_edition_id uuid, p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  e public.festival_editions%ROWTYPE;
  app public.festival_applications%ROWTYPE;
  c public.festival_contracts%ROWTYPE;
  authority boolean;
  status_ok boolean;
  window_ok boolean;
  reasons text[] := '{}';
  warnings text[] := '{}';
  hard text[] := '{}';
  advisory text[] := '{}';
  outcome text;
BEGIN
  SELECT * INTO e FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome','blocked','can_apply',false,'authority_allowed',false,'edition_status_allowed',false,'application_window_open',false,'hard_conflicts',ARRAY['Edition not found'],'advisory_conflicts','[]'::jsonb,'reasons',ARRAY['Edition not found'],'warnings','[]'::jsonb,'available_slot_types','[]'::jsonb);
  END IF;

  SELECT * INTO app FROM public.festival_applications WHERE edition_id = p_edition_id AND band_id = p_band_id AND status IN ('draft','submitted','under_review','waitlisted','shortlisted','offer_pending') ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO c FROM public.festival_contracts WHERE edition_id = p_edition_id AND band_id = p_band_id AND status IN ('awaiting_band_signature','awaiting_organiser_signature','awaiting_signatures','active','amendment_required') ORDER BY created_at DESC LIMIT 1;

  authority := public.can_apply_for_band(p_band_id, public.current_profile_id_safe());
  status_ok := e.status IN ('accepting_applications','booking','announced','on_sale');
  window_ok := (e.application_open_at IS NULL OR e.application_open_at <= now()) AND (e.application_close_at IS NULL OR e.application_close_at >= now());

  IF NOT authority THEN reasons := array_append(reasons, 'You are not authorised to apply for this band.'); END IF;
  IF NOT status_ok THEN reasons := array_append(reasons, 'This festival edition is not accepting applications.'); END IF;
  IF NOT window_ok THEN reasons := array_append(reasons, 'The application window is closed.'); END IF;
  IF app.id IS NOT NULL THEN reasons := array_append(reasons, 'This band already has an active application.'); END IF;
  IF c.id IS NOT NULL THEN reasons := array_append(reasons, 'This band already has an active festival contract.'); END IF;

  IF e.start_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.player_scheduled_activities psa
    JOIN public.band_members bm ON bm.user_id = psa.user_id AND bm.band_id = p_band_id
    WHERE psa.status IN ('scheduled','in_progress')
      AND tstzrange(psa.start_time, psa.end_time, '[)') && tstzrange(e.start_at, e.end_at, '[)')
  ) THEN
    advisory := array_append(advisory, 'One or more band members has a scheduled activity during the edition window.');
    warnings := array_append(warnings, 'Schedule conflicts may need to be resolved before contract activation.');
  END IF;

  hard := reasons;
  outcome := CASE WHEN array_length(hard, 1) IS NOT NULL THEN 'blocked' WHEN array_length(warnings, 1) IS NOT NULL THEN 'warning' ELSE 'allowed' END;

  RETURN jsonb_build_object(
    'outcome', outcome,
    'can_apply', outcome <> 'blocked',
    'authority_allowed', authority,
    'edition_status_allowed', status_ok,
    'application_window_open', window_ok,
    'existing_application_id', app.id,
    'existing_application_status', app.status,
    'existing_contract_id', c.id,
    'hard_conflicts', hard,
    'advisory_conflicts', advisory,
    'requested_duration_limits', jsonb_build_object('minimum_minutes', 5, 'maximum_minutes', 240),
    'currency_code', e.currency_code,
    'available_slot_types', COALESCE((SELECT jsonb_agg(DISTINCT ss.slot_type ORDER BY ss.slot_type) FROM public.festival_stage_slots ss WHERE ss.festival_id = e.festival_id AND ss.status = 'open'), '[]'::jsonb),
    'application_deadline', e.application_close_at,
    'reasons', reasons,
    'warnings', warnings
  );
END $$;

CREATE OR REPLACE FUNCTION public.festival_booking_slots(p_edition_id uuid)
RETURNS TABLE(slot_id uuid, stage_id uuid, stage_name text, start_at timestamptz, end_at timestamptz, slot_type text, duration_minutes integer, headline_eligible boolean, reservation_state text, reservation_expires_at timestamptz, current_band_id uuid, current_band_name text, technical_capacity_summary text, available boolean, unavailable_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT ss.id, ss.stage_id, st.stage_name, ss.start_time, ss.end_time, ss.slot_type,
    CASE WHEN ss.start_time IS NOT NULL AND ss.end_time IS NOT NULL THEN (EXTRACT(EPOCH FROM ss.end_time - ss.start_time) / 60)::int ELSE NULL END,
    ss.slot_type = 'headliner', ss.status, NULL::timestamptz, ss.band_id, b.name,
    concat('capacity ', coalesce(st.capacity, 0), coalesce(' · genre ' || st.genre_focus, '')),
    ss.status = 'open' AND ss.band_id IS NULL AND ss.canonical_contract_id IS NULL,
    CASE WHEN ss.status <> 'open' THEN 'Slot is not open' WHEN ss.band_id IS NOT NULL OR ss.canonical_contract_id IS NOT NULL THEN 'Slot is already reserved' ELSE NULL END
  FROM public.festival_editions e
  JOIN public.festival_stage_slots ss ON ss.festival_id = e.festival_id
  JOIN public.festival_stages st ON st.id = ss.stage_id
  LEFT JOIN public.bands b ON b.id = ss.band_id
  WHERE e.id = p_edition_id
  ORDER BY ss.start_time NULLS LAST, st.stage_number, ss.slot_number;
$$;

CREATE OR REPLACE FUNCTION public.festival_invitation_candidates(p_edition_id uuid, p_search text DEFAULT NULL)
RETURNS TABLE(band_id uuid, band_name text, primary_genres text[], fame integer, local_popularity integer, live_rating integer, member_count bigint, current_festival_booking_status text, schedule_warning_summary text, previous_festival_history_summary text, application_status public.festival_application_status, active_contract_status public.festival_contract_status, invitation_eligible boolean, unavailable_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH edition AS (SELECT * FROM public.festival_editions WHERE id = p_edition_id AND public.can_manage_festival_brand(festival_id))
  SELECT b.id, b.name::text, ARRAY_REMOVE(ARRAY[b.genre::text], NULL), b.popularity, b.popularity, b.popularity,
    (SELECT count(*) FROM public.band_members bm WHERE bm.band_id = b.id AND coalesce(bm.member_status,'active')='active'),
    c.status::text, NULL::text,
    CASE WHEN EXISTS (SELECT 1 FROM public.festival_contracts pc WHERE pc.band_id=b.id AND pc.status='active') THEN 'previous festival activity found' ELSE NULL END,
    a.status, c.status,
    c.id IS NULL,
    CASE WHEN c.id IS NOT NULL THEN 'Band already has an active contract for this edition' ELSE NULL END
  FROM edition e
  JOIN public.bands b ON true
  LEFT JOIN public.festival_applications a ON a.edition_id = e.id AND a.band_id = b.id AND a.status IN ('submitted','under_review','waitlisted','shortlisted','offer_pending')
  LEFT JOIN public.festival_contracts c ON c.edition_id = e.id AND c.band_id = b.id AND c.status IN ('awaiting_band_signature','awaiting_organiser_signature','awaiting_signatures','active','amendment_required')
  WHERE (p_search IS NULL OR b.name ILIKE '%' || p_search || '%' OR b.genre ILIKE '%' || p_search || '%')
  ORDER BY c.id IS NOT NULL, b.popularity DESC, lower(b.name), b.id
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.festival_contract_repertoire(p_contract_id uuid)
RETURNS TABLE(song_id uuid, title text, duration_seconds integer, genre text, writers text[], ownership_relationship text, performance_rights_status text, recorded_released_status text, familiarity integer, readiness integer, currently_used_in_setlist boolean, unavailable_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT s.id, s.title::text, 180, s.genre::text, ARRAY[]::text[], 'band_catalogue', 'authorised', CASE WHEN s.release_date IS NULL THEN 'unreleased' ELSE 'released' END, s.popularity, s.popularity,
    EXISTS (SELECT 1 FROM public.festival_contract_setlists sl JOIN public.festival_contract_setlist_items si ON si.setlist_id=sl.id WHERE sl.contract_id=p_contract_id AND si.song_id=s.id AND sl.is_current),
    NULL::text
  FROM public.festival_contracts c
  JOIN public.songs s ON s.band_id = c.band_id
  WHERE c.id = p_contract_id
    AND (public.can_negotiate_for_band(c.band_id, public.current_profile_id_safe()) OR EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=c.edition_id AND public.can_manage_festival_brand(e.festival_id)))
  ORDER BY lower(s.title), s.id;
$$;

CREATE OR REPLACE FUNCTION public.festival_setlist_preflight(p_contract_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  c public.festival_contracts%ROWTYPE;
  total integer := 0;
  maxsec integer := 0;
  minsec integer := 60;
  invalid text[] := '{}';
  duplicates text[] := '{}';
  unavailable text[] := '{}';
  warnings text[] := '{}';
  blockers text[] := '{}';
  seen uuid[] := '{}';
  item jsonb;
  sid uuid;
BEGIN
  SELECT * INTO c FROM public.festival_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN blockers := array_append(blockers, 'Contract not found'); END IF;
  maxsec := coalesce((c.terms_snapshot->>'set_duration_minutes')::int, 60) * 60;
  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' THEN blockers := array_append(blockers, 'Setlist items must be an array'); END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    total := total + coalesce((item->>'planned_duration_seconds')::int, 0);
    BEGIN sid := (item->>'song_id')::uuid; EXCEPTION WHEN others THEN sid := NULL; END;
    IF sid IS NULL THEN invalid := array_append(invalid, coalesce(item->>'song_id','')); CONTINUE; END IF;
    IF sid = ANY(seen) THEN duplicates := array_append(duplicates, sid::text); END IF;
    seen := array_append(seen, sid);
    IF c.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.songs s WHERE s.id = sid AND s.band_id = c.band_id) THEN unavailable := array_append(unavailable, sid::text); END IF;
  END LOOP;

  IF total > maxsec THEN blockers := array_append(blockers, 'Setlist exceeds contracted maximum duration'); END IF;
  IF total < minsec THEN warnings := array_append(warnings, 'Setlist is shorter than the recommended minimum duration'); END IF;
  IF array_length(invalid,1) IS NOT NULL THEN blockers := array_append(blockers, 'Setlist contains invalid song identifiers'); END IF;
  IF array_length(unavailable,1) IS NOT NULL THEN blockers := array_append(blockers, 'Setlist contains songs outside authorised repertoire'); END IF;

  RETURN jsonb_build_object('total_duration_seconds', total, 'contracted_maximum_seconds', maxsec, 'minimum_recommended_seconds', minsec, 'invalid_songs', invalid, 'duplicate_songs', duplicates, 'unavailable_songs', unavailable, 'guest_performer_issues', ARRAY[]::text[], 'readiness_warnings', ARRAY[]::text[], 'version_conflict', jsonb_build_object('current_version', (SELECT max(version) FROM public.festival_contract_setlists WHERE contract_id=p_contract_id), 'conflict', false), 'outcome', CASE WHEN array_length(blockers,1) IS NOT NULL THEN 'blocked' WHEN array_length(warnings,1) IS NOT NULL OR array_length(duplicates,1) IS NOT NULL THEN 'warning' ELSE 'allowed' END, 'blocking_reasons', blockers, 'warnings', warnings);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_represented_bands(), public.festival_application_eligibility(uuid,uuid), public.festival_invitation_candidates(uuid,text), public.festival_booking_slots(uuid), public.festival_contract_repertoire(uuid), public.festival_setlist_preflight(uuid,jsonb) TO authenticated;
