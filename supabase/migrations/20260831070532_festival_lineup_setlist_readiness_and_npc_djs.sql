CREATE OR REPLACE FUNCTION public.get_festival_artist_booking_schedule_queue(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  e public.festival_editions%ROWTYPE;
  actor uuid := public._caller_profile_id();
BEGIN
  SELECT * INTO STRICT e
  FROM public.festival_editions
  WHERE id = p_edition_id;

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

  RETURN jsonb_build_object(
    'editionId', e.id,
    'bookings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'artistType', b.artist_type,
        'bandId', b.band_id,
        'bandName', bd.name,
        'status', b.status,
        'setMinutes', b.set_minutes,
        'billingPosition', b.billing_position,
        'agreedFeeMinor', b.agreed_fee_minor,
        'currencyCode', b.currency_code,
        'preferredDate', b.provisional_date,
        'preferredStageId', b.provisional_stage_id,
        'supported', b.artist_type = 'band' AND b.band_id IS NOT NULL,
        'unsupportedReason', CASE
          WHEN b.artist_type = 'band' AND b.band_id IS NOT NULL THEN NULL
          ELSE 'Canonical festival performance contracts currently require a band.'
        END
      ) ORDER BY b.confirmed_at, b.created_at, b.id)
      FROM public.festival_artist_bookings b
      JOIN public.festival_artist_programmes pr ON pr.id = b.festival_artist_programme_id
      LEFT JOIN public.bands bd ON bd.id = b.band_id
      WHERE pr.festival_edition_id = e.id
        AND b.status = 'awaiting_schedule'
    ), '[]'::jsonb),
    'slots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'stageId', s.stage_id,
        'stageName', COALESCE(st.public_name, st.stage_name),
        'dayNumber', s.day_number,
        'slotNumber', s.slot_number,
        'slotType', s.slot_type,
        'startAt', s.start_time,
        'endAt', s.end_time
      ) ORDER BY s.start_time, s.stage_id, s.slot_number)
      FROM public.festival_stage_slots s
      JOIN public.festival_stages st ON st.id = s.stage_id
      WHERE s.edition_id = e.id
        AND s.status IN ('open','booked')
        AND s.canonical_contract_id IS NULL
        AND s.band_id IS NULL
        AND COALESCE(s.is_npc_dj, false) = false
        AND s.start_time IS NOT NULL
        AND s.end_time IS NOT NULL
    ), '[]'::jsonb),
    'lineup', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'stageId', s.stage_id,
        'stageName', COALESCE(st.public_name, st.stage_name),
        'dayNumber', s.day_number,
        'slotNumber', s.slot_number,
        'slotType', s.slot_type,
        'startAt', s.start_time,
        'endAt', s.end_time,
        'bandId', s.band_id,
        'bandName', bd.name,
        'contractId', s.canonical_contract_id,
        'isNpcDj', COALESCE(s.is_npc_dj, false),
        'npcDjName', s.npc_dj_name,
        'npcDjGenre', s.npc_dj_genre,
        'npcDjQuality', s.npc_dj_quality,
        'allocatedSetMinutes', CASE
          WHEN s.is_npc_dj THEN NULL
          ELSE NULLIF(c.terms_snapshot ->> 'set_duration_minutes', '')::integer
        END,
        'setlistId', sl.id,
        'setlistStatus', COALESCE(sl.status::text, 'not_set'),
        'setlistTotalSeconds', COALESCE(sl.total_duration_seconds, 0),
        'setlistMaximumSeconds', COALESCE(
          sl.maximum_duration_seconds,
          NULLIF(c.terms_snapshot ->> 'set_duration_minutes', '')::integer * 60
        ),
        'hasSetlist', sl.id IS NOT NULL,
        'setlistReady', COALESCE(sl.status::text IN ('submitted','approved','locked','performed'), false),
        'withinAllocation', CASE
          WHEN sl.id IS NULL THEN NULL
          ELSE sl.total_duration_seconds <= COALESCE(
            sl.maximum_duration_seconds,
            NULLIF(c.terms_snapshot ->> 'set_duration_minutes', '')::integer * 60
          )
        END,
        'remainingSeconds', CASE
          WHEN sl.id IS NULL THEN NULL
          ELSE COALESCE(
            sl.maximum_duration_seconds,
            NULLIF(c.terms_snapshot ->> 'set_duration_minutes', '')::integer * 60
          ) - sl.total_duration_seconds
        END
      ) ORDER BY s.start_time, s.stage_id, s.slot_number)
      FROM public.festival_stage_slots s
      JOIN public.festival_stages st ON st.id = s.stage_id
      LEFT JOIN public.bands bd ON bd.id = s.band_id
      LEFT JOIN public.festival_contracts c ON c.id = s.canonical_contract_id
      LEFT JOIN LATERAL (
        SELECT fs.*
        FROM public.festival_contract_setlists fs
        WHERE fs.contract_id = s.canonical_contract_id
          AND fs.is_current = true
        ORDER BY fs.version DESC, fs.updated_at DESC
        LIMIT 1
      ) sl ON true
      WHERE s.edition_id = e.id
        AND (s.band_id IS NOT NULL OR COALESCE(s.is_npc_dj, false) = true)
        AND s.status NOT IN ('cancelled','completed')
    ), '[]'::jsonb)
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.set_festival_stage_slot_npc_dj(
  p_stage_slot_id uuid,
  p_enabled boolean,
  p_name text DEFAULT NULL,
  p_genre text DEFAULT NULL,
  p_quality integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  slot public.festival_stage_slots%ROWTYPE;
  e public.festival_editions%ROWTYPE;
  dj_name text;
  dj_genre text;
  dj_quality integer;
BEGIN
  SELECT * INTO STRICT slot
  FROM public.festival_stage_slots
  WHERE id = p_stage_slot_id
  FOR UPDATE;

  IF slot.edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_stage_slot_edition_missing';
  END IF;

  SELECT * INTO STRICT e
  FROM public.festival_editions
  WHERE id = slot.edition_id;

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

  IF slot.canonical_contract_id IS NOT NULL OR slot.band_id IS NOT NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT';
  END IF;

  IF p_enabled THEN
    IF slot.status NOT IN ('open','booked','confirmed') THEN
      RAISE EXCEPTION 'festival_stage_slot_not_available';
    END IF;

    dj_name := COALESCE(NULLIF(btrim(p_name), ''), 'Festival DJ');
    dj_genre := COALESCE(NULLIF(btrim(p_genre), ''), 'Open format');
    dj_quality := GREATEST(0, LEAST(COALESCE(p_quality, 50), 100));

    UPDATE public.festival_stage_slots
    SET is_npc_dj = true,
        npc_dj_name = dj_name,
        npc_dj_genre = dj_genre,
        npc_dj_quality = dj_quality,
        status = 'confirmed',
        public_status = 'scheduled'
    WHERE id = slot.id
    RETURNING * INTO slot;
  ELSE
    IF COALESCE(slot.is_npc_dj, false) = false THEN
      RETURN jsonb_build_object('stageSlotId', slot.id, 'isNpcDj', false, 'replayed', true);
    END IF;

    UPDATE public.festival_stage_slots
    SET is_npc_dj = false,
        npc_dj_name = NULL,
        npc_dj_genre = NULL,
        npc_dj_quality = 50,
        status = 'open',
        public_status = 'draft'
    WHERE id = slot.id
    RETURNING * INTO slot;
  END IF;

  RETURN jsonb_build_object(
    'stageSlotId', slot.id,
    'isNpcDj', COALESCE(slot.is_npc_dj, false),
    'npcDjName', slot.npc_dj_name,
    'npcDjGenre', slot.npc_dj_genre,
    'npcDjQuality', slot.npc_dj_quality,
    'replayed', false
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.finalise_festival_artist_booking_slot(
  p_artist_booking_id uuid,
  p_stage_slot_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  b public.festival_artist_bookings%ROWTYPE;
  pr public.festival_artist_programmes%ROWTYPE;
  offer public.festival_artist_offers%ROWTYPE;
  e public.festival_editions%ROWTYPE;
  slot public.festival_stage_slots%ROWTYPE;
  contract public.festival_contracts%ROWTYPE;
  version_id uuid;
  terms jsonb;
  terms_hash text;
  signer uuid;
  link public.festival_artist_booking_canonical_links%ROWTYPE;
  stage_name text;
BEGIN
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'festival_artist_finalise_idempotency_required';
  END IF;

  SELECT * INTO link
  FROM public.festival_artist_booking_canonical_links
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'bookingId', link.artist_booking_id,
      'contractId', link.canonical_contract_id,
      'stageSlotId', link.stage_slot_id,
      'replayed', true
    );
  END IF;

  SELECT * INTO STRICT b
  FROM public.festival_artist_bookings
  WHERE id = p_artist_booking_id
  FOR UPDATE;

  SELECT * INTO STRICT pr
  FROM public.festival_artist_programmes
  WHERE id = b.festival_artist_programme_id;

  IF NOT public._festival_artist_manager(pr.festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden';
  END IF;

  IF pr.festival_edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_artist_programme_edition_missing';
  END IF;

  SELECT * INTO STRICT e
  FROM public.festival_editions
  WHERE id = pr.festival_edition_id
  FOR UPDATE;

  IF b.artist_type <> 'band' OR b.band_id IS NULL THEN
    RAISE EXCEPTION 'festival_artist_canonical_band_required';
  END IF;

  IF b.status NOT IN ('awaiting_schedule','confirmed') THEN
    RAISE EXCEPTION 'festival_artist_booking_not_schedulable';
  END IF;

  SELECT * INTO STRICT offer
  FROM public.festival_artist_offers
  WHERE id = b.offer_id
    AND status = 'accepted';

  SELECT * INTO STRICT slot
  FROM public.festival_stage_slots
  WHERE id = p_stage_slot_id
  FOR UPDATE;

  IF slot.edition_id IS DISTINCT FROM e.id
    OR slot.status NOT IN ('open','booked')
    OR slot.canonical_contract_id IS NOT NULL
    OR COALESCE(slot.is_npc_dj, false) = true
    OR (slot.band_id IS NOT NULL AND slot.band_id <> b.band_id)
  THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT';
  END IF;

  IF slot.start_time IS NULL OR slot.end_time IS NULL OR slot.end_time <= slot.start_time THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_INVALID_TIME';
  END IF;

  IF b.set_minutes IS NOT NULL
    AND EXTRACT(EPOCH FROM (slot.end_time - slot.start_time)) < (b.set_minutes * 60)
  THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_TOO_SHORT_FOR_SET';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_artist_booking_canonical_links
    WHERE artist_booking_id = b.id
  ) THEN
    SELECT * INTO link
    FROM public.festival_artist_booking_canonical_links
    WHERE artist_booking_id = b.id;

    IF link.stage_slot_id <> slot.id THEN
      RAISE EXCEPTION 'festival_artist_booking_already_finalised';
    END IF;

    RETURN jsonb_build_object(
      'bookingId', link.artist_booking_id,
      'contractId', link.canonical_contract_id,
      'stageSlotId', link.stage_slot_id,
      'replayed', true
    );
  END IF;

  SELECT actor_profile_id INTO signer
  FROM public.festival_artist_plan_audit
  WHERE entity_type = 'offer'
    AND entity_id = offer.id
    AND event_type = 'offer_accepted'
  ORDER BY created_at DESC
  LIMIT 1;

  terms := jsonb_build_object(
    'stage_slot_id', slot.id,
    'proposed_start_at', slot.start_time,
    'proposed_end_at', slot.end_time,
    'set_duration_minutes', b.set_minutes,
    'guarantee_fee_cents', b.agreed_fee_minor,
    'deposit_cents', 0,
    'performance_bonus_cents', 0,
    'merch_share_percent', COALESCE(offer.merch_revenue_share_basis_points, 0) / 100.0,
    'travel_terms', jsonb_build_object('support_minor', b.travel_support_minor),
    'accommodation_terms', jsonb_build_object('support_minor', b.accommodation_support_minor),
    'cancellation_terms', COALESCE(b.contract_terms -> 'cancellationTerms', '{}'::jsonb),
    'currency_code', b.currency_code,
    'metadata', jsonb_build_object(
      'source', 'festival_artist_booking',
      'artistBookingId', b.id,
      'artistOfferId', offer.id
    )
  );

  terms_hash := public.festival_terms_hash(terms);

  INSERT INTO public.festival_contracts(
    edition_id,
    band_id,
    festival_id,
    stage_slot_id,
    status,
    contract_version,
    terms_snapshot,
    band_signature_status,
    organiser_signature_status,
    band_signed_by_profile_id,
    organiser_signed_by_profile_id,
    band_signed_at,
    organiser_signed_at,
    activated_at,
    settlement_required
  ) VALUES (
    e.id,
    b.band_id,
    e.festival_id,
    slot.id,
    'active',
    1,
    terms,
    'signed',
    'signed',
    signer,
    offer.created_by_profile_id,
    COALESCE(offer.accepted_at, now()),
    offer.created_at,
    now(),
    true
  )
  RETURNING * INTO contract;

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
    1,
    terms,
    terms_hash,
    offer.created_by_profile_id,
    'organiser',
    'Converted from accepted festival artist offer'
  )
  RETURNING id INTO version_id;

  UPDATE public.festival_contracts
  SET current_version_id = version_id
  WHERE id = contract.id
  RETURNING * INTO contract;

  UPDATE public.festival_stage_slots
  SET band_id = b.band_id,
      canonical_contract_id = contract.id,
      is_npc_dj = false,
      npc_dj_name = NULL,
      npc_dj_genre = NULL,
      status = 'confirmed',
      public_status = 'scheduled'
  WHERE id = slot.id;

  INSERT INTO public.festival_stage_slot_reservations(
    edition_id,
    stage_slot_id,
    contract_id,
    band_id,
    status,
    confirmed_at
  ) VALUES (
    e.id,
    slot.id,
    contract.id,
    b.band_id,
    'confirmed',
    now()
  );

  UPDATE public.festival_artist_bookings
  SET status = 'confirmed',
      provisional_stage_id = slot.stage_id,
      provisional_date = slot.start_time::date,
      confirmed_at = COALESCE(confirmed_at, now()),
      updated_at = now(),
      version = version + 1
  WHERE id = b.id
  RETURNING * INTO b;

  INSERT INTO public.festival_artist_booking_canonical_links(
    artist_booking_id,
    edition_id,
    canonical_contract_id,
    stage_slot_id,
    idempotency_key,
    created_by_profile_id
  ) VALUES (
    b.id,
    e.id,
    contract.id,
    slot.id,
    p_idempotency_key,
    actor
  )
  RETURNING * INTO link;

  SELECT COALESCE(st.public_name, st.stage_name)
  INTO stage_name
  FROM public.festival_stages st
  WHERE st.id = slot.stage_id;

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
    'festival_schedule_confirmed',
    'Festival stage slot confirmed',
    'Your band has been scheduled for a ' || COALESCE(b.set_minutes, 0)::text ||
      '-minute festival set on ' || COALESCE(stage_name, 'your festival stage') ||
      ', starting ' || to_char(slot.start_time, 'Dy DD Mon YYYY HH24:MI') ||
      '. Choose and submit a festival setlist within the allocated time.',
    jsonb_build_object(
      'festivalId', e.festival_id,
      'festivalEditionId', e.id,
      'artistBookingId', b.id,
      'bandId', b.band_id,
      'contractId', contract.id,
      'stageSlotId', slot.id,
      'stageId', slot.stage_id,
      'allocatedSetMinutes', b.set_minutes,
      'startsAt', slot.start_time,
      'endsAt', slot.end_time
    ),
    'festival',
    'normal'
  FROM (
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = b.band_id
      AND bm.member_status = 'active'
      AND bm.profile_id IS NOT NULL
    UNION
    SELECT bd.leader_id
    FROM public.bands bd
    WHERE bd.id = b.band_id
  ) recipients
  JOIN public.profiles p ON p.id = recipients.profile_id;

  PERFORM public._festival_record_organiser_audit(
    e.festival_id,
    e.id,
    'artist_booking_finalised',
    'festival_contract',
    contract.id,
    jsonb_build_object('artistBookingId', b.id, 'bookingStatus', 'awaiting_schedule'),
    jsonb_build_object(
      'artistBookingId', b.id,
      'bookingStatus', b.status,
      'contractId', contract.id,
      'stageSlotId', slot.id
    ),
    'Accepted artist booking mapped to canonical contract and slot',
    jsonb_build_object('termsHash', terms_hash),
    p_idempotency_key
  );

  RETURN jsonb_build_object(
    'bookingId', b.id,
    'contractId', contract.id,
    'stageSlotId', slot.id,
    'replayed', false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_festival_stage_slot_npc_dj(uuid, boolean, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_festival_stage_slot_npc_dj(uuid, boolean, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.finalise_festival_artist_booking_slot(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalise_festival_artist_booking_slot(uuid, uuid, text) TO authenticated;
