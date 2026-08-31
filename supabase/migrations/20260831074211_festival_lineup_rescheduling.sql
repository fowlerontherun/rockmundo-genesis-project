CREATE OR REPLACE FUNCTION public.move_festival_artist_booking_slot(
  p_contract_id uuid,
  p_target_stage_slot_id uuid,
  p_expected_current_stage_slot_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  contract public.festival_contracts%ROWTYPE;
  e public.festival_editions%ROWTYPE;
  current_slot public.festival_stage_slots%ROWTYPE;
  target_slot public.festival_stage_slots%ROWTYPE;
  link public.festival_artist_booking_canonical_links%ROWTYPE;
  booking public.festival_artist_bookings%ROWTYPE;
  new_terms jsonb;
  new_terms_hash text;
  new_version integer;
  new_version_id uuid;
  target_stage_name text;
  set_minutes integer;
BEGIN
  SELECT * INTO STRICT contract
  FROM public.festival_contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF contract.status <> 'active' THEN
    RAISE EXCEPTION 'festival_contract_not_reschedulable';
  END IF;

  SELECT * INTO STRICT e
  FROM public.festival_editions
  WHERE id = contract.edition_id
  FOR UPDATE;

  IF NOT (
    public.can_manage_festival_edition(e.id)
    OR EXISTS (
      SELECT 1
      FROM public.festival_edition_management_roles r
      WHERE r.edition_id = e.id
        AND r.profile_id = actor
        AND r.status = 'active'
        AND r.role IN ('delegated_manager','talent_booker','operations_manager','stage_manager')
        AND (r.ends_at IS NULL OR r.ends_at > now())
    )
  ) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;

  IF contract.stage_slot_id IS NULL THEN
    RAISE EXCEPTION 'festival_contract_stage_slot_missing';
  END IF;

  IF p_expected_current_stage_slot_id IS NOT NULL
    AND contract.stage_slot_id IS DISTINCT FROM p_expected_current_stage_slot_id
  THEN
    RAISE EXCEPTION 'festival_lineup_changed_refresh_required';
  END IF;

  IF contract.stage_slot_id = p_target_stage_slot_id THEN
    RETURN jsonb_build_object(
      'contractId', contract.id,
      'previousStageSlotId', contract.stage_slot_id,
      'stageSlotId', contract.stage_slot_id,
      'contractVersion', contract.contract_version,
      'replayed', true
    );
  END IF;

  SELECT * INTO STRICT current_slot
  FROM public.festival_stage_slots
  WHERE id = contract.stage_slot_id
  FOR UPDATE;

  SELECT * INTO STRICT target_slot
  FROM public.festival_stage_slots
  WHERE id = p_target_stage_slot_id
  FOR UPDATE;

  IF current_slot.edition_id IS DISTINCT FROM e.id
    OR current_slot.canonical_contract_id IS DISTINCT FROM contract.id
    OR current_slot.band_id IS DISTINCT FROM contract.band_id
  THEN
    RAISE EXCEPTION 'festival_current_slot_contract_mismatch';
  END IF;

  IF target_slot.edition_id IS DISTINCT FROM e.id
    OR target_slot.status NOT IN ('open','booked')
    OR target_slot.canonical_contract_id IS NOT NULL
    OR target_slot.band_id IS NOT NULL
    OR COALESCE(target_slot.is_npc_dj, false) = true
    OR target_slot.start_time IS NULL
    OR target_slot.end_time IS NULL
    OR target_slot.end_time <= target_slot.start_time
  THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_stage_slot_reservations r
    WHERE r.stage_slot_id = target_slot.id
      AND r.status IN ('provisional','confirmed')
  ) OR EXISTS (
    SELECT 1
    FROM public.festival_artist_booking_canonical_links l
    WHERE l.stage_slot_id = target_slot.id
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT';
  END IF;

  SELECT * INTO STRICT link
  FROM public.festival_artist_booking_canonical_links
  WHERE canonical_contract_id = contract.id
  FOR UPDATE;

  SELECT * INTO STRICT booking
  FROM public.festival_artist_bookings
  WHERE id = link.artist_booking_id
  FOR UPDATE;

  set_minutes := COALESCE(
    NULLIF(contract.terms_snapshot ->> 'set_duration_minutes', '')::integer,
    booking.set_minutes
  );

  IF set_minutes IS NOT NULL
    AND EXTRACT(EPOCH FROM (target_slot.end_time - target_slot.start_time)) < (set_minutes * 60)
  THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_TOO_SHORT_FOR_SET';
  END IF;

  new_terms := contract.terms_snapshot || jsonb_build_object(
    'stage_slot_id', target_slot.id,
    'proposed_start_at', target_slot.start_time,
    'proposed_end_at', target_slot.end_time
  );
  new_terms_hash := public.festival_terms_hash(new_terms);
  new_version := contract.contract_version + 1;

  UPDATE public.festival_stage_slot_reservations
  SET status = 'released',
      released_at = now(),
      release_reason = 'Festival lineup rescheduled'
  WHERE contract_id = contract.id
    AND status IN ('provisional','confirmed');

  UPDATE public.festival_stage_slots
  SET band_id = NULL,
      canonical_contract_id = NULL,
      status = 'open',
      public_status = 'draft'
  WHERE id = current_slot.id;

  UPDATE public.festival_stage_slots
  SET band_id = contract.band_id,
      canonical_contract_id = contract.id,
      is_npc_dj = false,
      npc_dj_name = NULL,
      npc_dj_genre = NULL,
      status = 'confirmed',
      public_status = 'scheduled'
  WHERE id = target_slot.id;

  INSERT INTO public.festival_stage_slot_reservations(
    edition_id,
    stage_slot_id,
    contract_id,
    band_id,
    status,
    confirmed_at
  ) VALUES (
    e.id,
    target_slot.id,
    contract.id,
    contract.band_id,
    'confirmed',
    now()
  );

  INSERT INTO public.festival_contract_versions(
    contract_id,
    version,
    terms_snapshot,
    terms_hash,
    created_by_profile_id,
    created_by_side,
    reason
  ) VALUES (
    contract.id,
    new_version,
    new_terms,
    new_terms_hash,
    actor,
    'organiser',
    'Festival lineup rescheduled'
  )
  RETURNING id INTO new_version_id;

  UPDATE public.festival_contracts
  SET stage_slot_id = target_slot.id,
      contract_version = new_version,
      terms_snapshot = new_terms,
      current_version_id = new_version_id,
      updated_at = now()
  WHERE id = contract.id
  RETURNING * INTO contract;

  UPDATE public.festival_artist_booking_canonical_links
  SET stage_slot_id = target_slot.id
  WHERE id = link.id
  RETURNING * INTO link;

  UPDATE public.festival_artist_bookings
  SET provisional_stage_id = target_slot.stage_id,
      provisional_date = target_slot.start_time::date,
      updated_at = now(),
      version = version + 1
  WHERE id = booking.id
  RETURNING * INTO booking;

  SELECT COALESCE(st.public_name, st.stage_name)
  INTO target_stage_name
  FROM public.festival_stages st
  WHERE st.id = target_slot.stage_id;

  INSERT INTO public.notifications(
    user_id,
    profile_id,
    type,
    title,
    message,
    metadata,
    category,
    priority
  )
  SELECT DISTINCT
    p.user_id,
    p.id,
    'festival_schedule_updated',
    'Festival stage time updated',
    'Your festival slot has changed. Your ' || COALESCE(set_minutes, 0)::text ||
      '-minute set is now on ' || COALESCE(target_stage_name, 'the festival stage') ||
      ', starting ' || to_char(target_slot.start_time, 'Dy DD Mon YYYY HH24:MI') ||
      '. Review your festival setlist and travel plans.',
    jsonb_build_object(
      'festivalId', e.festival_id,
      'festivalEditionId', e.id,
      'artistBookingId', booking.id,
      'bandId', contract.band_id,
      'contractId', contract.id,
      'previousStageSlotId', current_slot.id,
      'stageSlotId', target_slot.id,
      'stageId', target_slot.stage_id,
      'allocatedSetMinutes', set_minutes,
      'startsAt', target_slot.start_time,
      'endsAt', target_slot.end_time
    ),
    'festival',
    'normal'
  FROM (
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = contract.band_id
      AND bm.member_status = 'active'
      AND bm.profile_id IS NOT NULL
    UNION
    SELECT bd.leader_id
    FROM public.bands bd
    WHERE bd.id = contract.band_id
  ) recipients
  JOIN public.profiles p ON p.id = recipients.profile_id;

  PERFORM public._festival_record_organiser_audit(
    e.festival_id,
    e.id,
    'artist_booking_rescheduled',
    'festival_contract',
    contract.id,
    jsonb_build_object(
      'artistBookingId', booking.id,
      'stageSlotId', current_slot.id,
      'contractVersion', new_version - 1
    ),
    jsonb_build_object(
      'artistBookingId', booking.id,
      'stageSlotId', target_slot.id,
      'contractVersion', new_version
    ),
    'Festival lineup running order changed',
    jsonb_build_object('termsHash', new_terms_hash),
    'lineup-reschedule:' || contract.id::text || ':' || new_version::text
  );

  RETURN jsonb_build_object(
    'contractId', contract.id,
    'bookingId', booking.id,
    'previousStageSlotId', current_slot.id,
    'stageSlotId', target_slot.id,
    'contractVersion', new_version,
    'replayed', false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) TO authenticated;
