-- Complete the simplified annual Festival line-up with exact-edition manager actions.
-- The older artist workflow was company-scoped and became ambiguous after annual
-- editions were introduced. These RPCs bind every owner action to one programme.

CREATE OR REPLACE FUNCTION public._festival_artist_manager(
  p_company uuid,
  p_profile uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._festival_company_manager_authorized(p_company, p_profile)
$$;

CREATE OR REPLACE FUNCTION public._festival_artist_committed_minor(
  p_programme_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(sum(commitment.amount_minor), 0)::bigint
  FROM public.festival_financial_commitments commitment
  JOIN public.festival_artist_bookings booking
    ON booking.id = commitment.artist_booking_id
  WHERE booking.festival_artist_programme_id = p_programme_id
    AND commitment.status = 'committed'
$$;

CREATE OR REPLACE FUNCTION public.search_festival_edition_artist_candidates(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  safe_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  term text := nullif(btrim(coalesce(p_query, '')), '');
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.festival_editions_v2 edition
    WHERE edition.id = p_festival_edition_id
      AND edition.festival_company_id = p_festival_company_id
  ) THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'items', coalesce((
      WITH candidates AS (
        SELECT
          'solo'::text AS artist_type,
          profile.id AS artist_id,
          coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Solo artist') AS display_name,
          ARRAY[]::text[] AS genres,
          greatest(0, coalesce(profile.fame, 0))::integer AS fame,
          0::integer AS popularity,
          greatest(0, coalesce(profile.fame, 0) * 100)::bigint AS minimum_fee,
          greatest(10000, coalesce(profile.fame, 0) * 250)::bigint AS maximum_fee
        FROM public.profiles profile
        WHERE term IS NULL
          OR profile.display_name ILIKE '%' || term || '%'
          OR profile.username ILIKE '%' || term || '%'

        UNION ALL

        SELECT
          'band'::text AS artist_type,
          band.id AS artist_id,
          coalesce(nullif(btrim(band.name), ''), 'Band') AS display_name,
          CASE WHEN nullif(btrim(coalesce(band.genre, '')), '') IS NULL
            THEN ARRAY[]::text[]
            ELSE ARRAY[band.genre]::text[]
          END AS genres,
          greatest(0, coalesce(band.popularity, 0))::integer AS fame,
          greatest(0, coalesce(band.popularity, 0))::integer AS popularity,
          greatest(0, coalesce(band.popularity, 0) * 200)::bigint AS minimum_fee,
          greatest(15000, coalesce(band.popularity, 0) * 500)::bigint AS maximum_fee
        FROM public.bands band
        WHERE term IS NULL OR band.name ILIKE '%' || term || '%'
      ), page AS (
        SELECT *
        FROM candidates
        ORDER BY fame DESC, display_name, artist_id
        LIMIT safe_limit OFFSET safe_offset
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'identity', CASE page.artist_type
            WHEN 'solo' THEN jsonb_build_object('type', 'solo', 'artistProfileId', page.artist_id)
            ELSE jsonb_build_object('type', 'band', 'bandId', page.artist_id)
          END,
          'displayName', page.display_name,
          'playerNpc', 'player',
          'genres', to_jsonb(page.genres),
          'fame', page.fame,
          'popularity', page.popularity,
          'homeCity', NULL,
          'estimatedFeeMinimumMinor', page.minimum_fee,
          'estimatedFeeMaximumMinor', page.maximum_fee,
          'availabilityState', 'unknown',
          'stageSuitability', least(100, greatest(0, page.fame)),
          'genreFit', CASE
            WHEN cardinality(programme.preferred_genres) = 0 THEN 50
            WHEN page.genres && programme.preferred_genres THEN 100
            ELSE 25
          END,
          'audienceFit', least(100, greatest(0, page.fame)),
          'relationshipState', CASE
            WHEN EXISTS (
              SELECT 1 FROM public.festival_artist_bookings booking
              WHERE booking.festival_artist_programme_id = programme.id
                AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled')
                AND ((page.artist_type = 'solo' AND booking.artist_profile_id = page.artist_id)
                  OR (page.artist_type = 'band' AND booking.band_id = page.artist_id))
            ) THEN 'booked'
            WHEN EXISTS (
              SELECT 1 FROM public.festival_artist_offers offer
              WHERE offer.festival_artist_programme_id = programme.id
                AND offer.status IN ('draft', 'sent', 'countered')
                AND ((page.artist_type = 'solo' AND offer.artist_profile_id = page.artist_id)
                  OR (page.artist_type = 'band' AND offer.band_id = page.artist_id))
            ) THEN 'offered'
            WHEN EXISTS (
              SELECT 1 FROM public.festival_artist_invitations invitation
              WHERE invitation.festival_artist_programme_id = programme.id
                AND invitation.status IN ('draft', 'sent', 'viewed', 'interested')
                AND ((page.artist_type = 'solo' AND invitation.artist_profile_id = page.artist_id)
                  OR (page.artist_type = 'band' AND invitation.band_id = page.artist_id))
            ) THEN 'invited'
            ELSE 'none'
          END
        )
        ORDER BY page.fame DESC, page.display_name, page.artist_id
      )
      FROM page
    ), '[]'::jsonb),
    'limit', safe_limit,
    'offset', safe_offset
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.send_festival_edition_artist_invitation(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_artist_type text,
  p_artist_profile_id uuid,
  p_band_id uuid,
  p_suggested_fee_minor bigint,
  p_suggested_set_minutes integer,
  p_suggested_dates date[],
  p_response_deadline timestamptz,
  p_message text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  invitation public.festival_artist_invitations%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  target_id uuid := coalesce(p_artist_profile_id, p_band_id);
  recipient uuid;
  payload jsonb;
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  IF p_artist_type NOT IN ('solo', 'band')
    OR (p_artist_type = 'solo') <> (p_artist_profile_id IS NOT NULL)
    OR (p_artist_type = 'band') <> (p_band_id IS NOT NULL)
    OR p_suggested_fee_minor < 0
    OR p_suggested_set_minutes NOT BETWEEN 10 AND 240
    OR p_response_deadline IS NULL
    OR p_response_deadline <= now()
  THEN
    RAISE EXCEPTION 'festival_artist_invitation_invalid' USING ERRCODE = 'P0001';
  END IF;

  payload := jsonb_build_object(
    'edition', p_festival_edition_id,
    'type', p_artist_type,
    'profile', p_artist_profile_id,
    'band', p_band_id,
    'fee', p_suggested_fee_minor,
    'setMinutes', p_suggested_set_minutes,
    'dates', coalesce(p_suggested_dates, '{}'),
    'deadline', p_response_deadline,
    'message', p_message
  );
  request := public._festival_artist_begin(
    p_festival_company_id,
    'send_edition_invitation',
    'invitation',
    target_id,
    p_idempotency_key,
    payload
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  BEGIN
    INSERT INTO public.festival_artist_invitations(
      festival_artist_programme_id,
      artist_type,
      artist_profile_id,
      band_id,
      invited_by_profile_id,
      status,
      message,
      suggested_fee_minor,
      suggested_set_minutes,
      suggested_dates,
      suggested_stage_types,
      expires_at
    ) VALUES (
      programme.id,
      p_artist_type,
      p_artist_profile_id,
      p_band_id,
      actor,
      'sent',
      nullif(btrim(coalesce(p_message, '')), ''),
      p_suggested_fee_minor,
      p_suggested_set_minutes,
      coalesce(p_suggested_dates, '{}'),
      '{}',
      p_response_deadline
    ) RETURNING * INTO invitation;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'festival_artist_invitation_duplicate' USING ERRCODE = 'P0001';
  END;

  PERFORM public._festival_artist_audit(
    p_festival_company_id,
    actor,
    'invitation',
    invitation.id,
    'invitation_sent',
    NULL,
    'sent',
    invitation.version
  );

  IF p_artist_profile_id IS NOT NULL THEN
    PERFORM public._festival_artist_notify(
      request.id,
      p_artist_profile_id,
      'invitation_received',
      'Festival invitation received',
      'A Festival manager invited you to discuss a performance.'
    );
  ELSE
    FOR recipient IN
      SELECT DISTINCT member.profile_id
      FROM public.band_members member
      WHERE member.band_id = p_band_id
        AND member.profile_id IS NOT NULL
        AND coalesce(member.member_status, 'active') = 'active'
        AND lower(coalesce(member.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
    LOOP
      PERFORM public._festival_artist_notify(
        request.id,
        recipient,
        'invitation_received',
        'Festival invitation received',
        'Your band has received a Festival invitation.'
      );
    END LOOP;
  END IF;

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object('kind', 'invitation', 'invitation', to_jsonb(invitation))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_festival_edition_artist_offer(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_application_id uuid,
  p_invitation_id uuid,
  p_artist_type text,
  p_artist_profile_id uuid,
  p_band_id uuid,
  p_terms jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  application public.festival_artist_applications%ROWTYPE;
  invitation public.festival_artist_invitations%ROWTYPE;
  offer public.festival_artist_offers%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  target_id uuid;
  fee bigint := coalesce((p_terms->>'feeMinor')::bigint, 0);
  set_minutes integer := coalesce((p_terms->>'setMinutes')::integer, 60);
  billing text := coalesce(nullif(p_terms->>'billingPosition', ''), 'support');
  response_deadline timestamptz := (p_terms->>'responseDeadline')::timestamptz;
  preferred_date date := (p_terms->>'preferredDate')::date;
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  IF p_application_id IS NOT NULL AND p_invitation_id IS NOT NULL THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF p_application_id IS NOT NULL THEN
    SELECT * INTO application
    FROM public.festival_artist_applications
    WHERE id = p_application_id
      AND festival_artist_programme_id = programme.id
    FOR UPDATE;
    IF NOT FOUND OR application.status NOT IN ('submitted', 'under_review', 'shortlisted', 'offer_pending') THEN
      RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
    END IF;
    p_artist_type := application.artist_type;
    p_artist_profile_id := application.artist_profile_id;
    p_band_id := application.band_id;
  ELSIF p_invitation_id IS NOT NULL THEN
    SELECT * INTO invitation
    FROM public.festival_artist_invitations
    WHERE id = p_invitation_id
      AND festival_artist_programme_id = programme.id
    FOR UPDATE;
    IF NOT FOUND OR invitation.status NOT IN ('sent', 'viewed', 'interested') THEN
      RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
    END IF;
    p_artist_type := invitation.artist_type;
    p_artist_profile_id := invitation.artist_profile_id;
    p_band_id := invitation.band_id;
  END IF;

  IF p_artist_type NOT IN ('solo', 'band')
    OR (p_artist_type = 'solo') <> (p_artist_profile_id IS NOT NULL)
    OR (p_artist_type = 'band') <> (p_band_id IS NOT NULL)
    OR fee < 0
    OR set_minutes NOT BETWEEN 10 AND 240
    OR billing NOT IN ('headliner', 'sub_headliner', 'featured', 'support', 'emerging', 'special_guest')
    OR response_deadline IS NULL
    OR response_deadline <= now()
    OR (preferred_date IS NOT NULL AND NOT preferred_date = ANY(
      ARRAY(
        SELECT day::date
        FROM generate_series(
          (SELECT starts_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
          (SELECT ends_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
          interval '1 day'
        ) day
      )
    ))
  THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_artist_offers existing_offer
    WHERE existing_offer.festival_artist_programme_id = programme.id
      AND existing_offer.status IN ('draft', 'sent', 'countered', 'accepted')
      AND ((p_artist_type = 'solo' AND existing_offer.artist_profile_id = p_artist_profile_id)
        OR (p_artist_type = 'band' AND existing_offer.band_id = p_band_id))
  ) THEN
    RAISE EXCEPTION 'festival_artist_offer_duplicate' USING ERRCODE = 'P0001';
  END IF;

  target_id := coalesce(p_application_id, p_invitation_id, p_artist_profile_id, p_band_id);
  request := public._festival_artist_begin(
    p_festival_company_id,
    'create_edition_offer',
    'offer',
    target_id,
    p_idempotency_key,
    jsonb_build_object(
      'edition', p_festival_edition_id,
      'application', p_application_id,
      'invitation', p_invitation_id,
      'type', p_artist_type,
      'profile', p_artist_profile_id,
      'band', p_band_id,
      'terms', p_terms
    )
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  INSERT INTO public.festival_artist_offers(
    festival_artist_programme_id,
    application_id,
    invitation_id,
    artist_type,
    artist_profile_id,
    band_id,
    offered_fee_minor,
    currency_code,
    set_minutes,
    performance_count,
    preferred_date,
    preferred_stage_id,
    billing_position,
    travel_support_minor,
    accommodation_support_minor,
    merch_revenue_share_basis_points,
    response_deadline,
    created_by_profile_id
  ) VALUES (
    programme.id,
    p_application_id,
    p_invitation_id,
    p_artist_type,
    p_artist_profile_id,
    p_band_id,
    fee,
    programme.currency_code,
    set_minutes,
    greatest(1, least(10, coalesce((p_terms->>'performanceCount')::integer, 1))),
    preferred_date,
    NULL,
    billing,
    greatest(0, coalesce((p_terms->>'travelSupportMinor')::bigint, 0)),
    greatest(0, coalesce((p_terms->>'accommodationSupportMinor')::bigint, 0)),
    greatest(0, least(10000, coalesce((p_terms->>'merchShareBasisPoints')::integer, 0))),
    response_deadline,
    actor
  ) RETURNING * INTO offer;

  INSERT INTO public.festival_artist_offer_revisions(
    offer_id,
    offer_version,
    proposed_by_party,
    proposed_by_profile_id,
    fee_minor,
    set_minutes,
    preferred_date,
    preferred_stage_id,
    billing_position,
    travel_support_minor,
    accommodation_support_minor,
    merch_revenue_share_basis_points,
    terms_snapshot,
    message
  ) VALUES (
    offer.id,
    offer.offer_version,
    'festival',
    actor,
    offer.offered_fee_minor,
    offer.set_minutes,
    offer.preferred_date,
    offer.preferred_stage_id,
    offer.billing_position,
    offer.travel_support_minor,
    offer.accommodation_support_minor,
    offer.merch_revenue_share_basis_points,
    p_terms,
    p_terms->>'message'
  );

  IF p_application_id IS NOT NULL AND application.status <> 'offer_pending' THEN
    UPDATE public.festival_artist_applications
    SET status = 'offer_pending', reviewed_at = coalesce(reviewed_at, now()), updated_at = now(), version = version + 1
    WHERE id = p_application_id;
  END IF;

  PERFORM public._festival_artist_audit(
    p_festival_company_id,
    actor,
    'offer',
    offer.id,
    'offer_created',
    NULL,
    'draft',
    offer.offer_version
  );

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object('kind', 'offer', 'offer', to_jsonb(offer))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.send_festival_edition_artist_offer(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  programme public.festival_artist_programmes%ROWTYPE;
  offer public.festival_artist_offers%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  budget bigint;
  reserved bigint;
  recipient uuid;
BEGIN
  IF actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO offer
  FROM public.festival_artist_offers
  WHERE id = p_offer_id
    AND festival_artist_programme_id = programme.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
  END IF;

  request := public._festival_artist_begin(
    p_festival_company_id,
    'send_edition_offer',
    'offer',
    offer.id,
    p_idempotency_key,
    jsonb_build_object('edition', p_festival_edition_id, 'version', p_expected_version)
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  IF offer.offer_version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_artist_offer_stale' USING ERRCODE = 'P0001';
  END IF;
  IF offer.status NOT IN ('draft', 'countered')
    OR offer.response_deadline IS NULL
    OR offer.response_deadline <= now()
  THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  budget := programme.artist_budget_minor + programme.contingency_budget_minor;
  reserved := public._festival_artist_committed_minor(programme.id)
    + coalesce((
      SELECT sum(existing_offer.offered_fee_minor + existing_offer.travel_support_minor + existing_offer.accommodation_support_minor)
      FROM public.festival_artist_offers existing_offer
      WHERE existing_offer.festival_artist_programme_id = programme.id
        AND existing_offer.id <> offer.id
        AND existing_offer.status IN ('sent', 'countered')
    ), 0);

  IF reserved + offer.offered_fee_minor + offer.travel_support_minor + offer.accommodation_support_minor > budget THEN
    RAISE EXCEPTION 'festival_artist_offer_budget_exceeded' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_artist_offers
  SET status = 'sent', updated_at = now()
  WHERE id = offer.id
  RETURNING * INTO offer;

  PERFORM public._festival_artist_audit(
    p_festival_company_id,
    actor,
    'offer',
    offer.id,
    'offer_sent',
    'draft',
    'sent',
    offer.offer_version
  );

  IF offer.artist_profile_id IS NOT NULL THEN
    PERFORM public._festival_artist_notify(
      request.id,
      offer.artist_profile_id,
      'offer_received',
      'Festival offer received',
      'A Festival performance offer is ready for your review.'
    );
  ELSE
    FOR recipient IN
      SELECT DISTINCT member.profile_id
      FROM public.band_members member
      WHERE member.band_id = offer.band_id
        AND member.profile_id IS NOT NULL
        AND coalesce(member.member_status, 'active') = 'active'
        AND lower(coalesce(member.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
    LOOP
      PERFORM public._festival_artist_notify(
        request.id,
        recipient,
        'offer_received',
        'Festival offer received',
        'Your band has received a Festival performance offer.'
      );
    END LOOP;
  END IF;

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object('kind', 'offer', 'offer', to_jsonb(offer))
  );
END;
$$;

-- Keep the existing artist response endpoint for player/band clients, but make
-- its budget check programme/edition-local so a previous year cannot consume a
-- later year's artist budget.
CREATE OR REPLACE FUNCTION public.respond_to_festival_artist_offer(
  p_offer_id uuid,
  p_expected_version integer,
  p_response text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  offer public.festival_artist_offers%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE;
  booking public.festival_artist_bookings%ROWTYPE;
  commitment public.festival_financial_commitments%ROWTYPE;
  total bigint;
  committed bigint;
BEGIN
  SELECT * INTO offer
  FROM public.festival_artist_offers
  WHERE id = p_offer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE id = offer.festival_artist_programme_id
  FOR UPDATE;

  request := public._festival_artist_begin(
    programme.festival_company_id,
    'respond_offer',
    'offer',
    offer.id,
    p_idempotency_key,
    jsonb_build_object('version', p_expected_version, 'response', p_response)
  );
  IF request.status = 'succeeded' THEN
    RETURN request.result;
  END IF;

  IF NOT public._festival_artist_authorised(
      actor,
      offer.artist_type,
      offer.artist_profile_id,
      offer.band_id
    )
    OR p_response NOT IN ('accept', 'decline')
  THEN
    RAISE EXCEPTION 'festival_artist_action_forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF offer.offer_version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_artist_offer_stale' USING ERRCODE = 'P0001';
  END IF;
  IF offer.status NOT IN ('sent', 'countered')
    OR offer.response_deadline IS NULL
    OR offer.response_deadline <= now()
  THEN
    RAISE EXCEPTION 'festival_artist_offer_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  IF p_response = 'decline' THEN
    UPDATE public.festival_artist_offers
    SET status = 'declined', declined_at = now(), updated_at = now()
    WHERE id = offer.id
    RETURNING * INTO offer;
    PERFORM public._festival_artist_audit(
      programme.festival_company_id,
      actor,
      'offer',
      offer.id,
      'offer_declined',
      NULL,
      'declined',
      offer.offer_version
    );
    RETURN public._festival_artist_finish(
      request.id,
      jsonb_build_object('kind', 'offer', 'offer', to_jsonb(offer))
    );
  END IF;

  total := offer.offered_fee_minor + offer.travel_support_minor + offer.accommodation_support_minor;
  committed := public._festival_artist_committed_minor(programme.id);
  IF committed + total > programme.artist_budget_minor + programme.contingency_budget_minor THEN
    RAISE EXCEPTION 'festival_artist_offer_budget_exceeded' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_artist_offers
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = offer.id
  RETURNING * INTO offer;

  UPDATE public.festival_artist_offer_revisions
  SET terms_snapshot = terms_snapshot || jsonb_build_object('acceptedAt', now())
  WHERE offer_id = offer.id
    AND offer_version = offer.offer_version;

  INSERT INTO public.festival_artist_bookings(
    festival_artist_programme_id,
    offer_id,
    artist_type,
    artist_profile_id,
    band_id,
    npc_artist_id,
    agreed_fee_minor,
    travel_support_minor,
    accommodation_support_minor,
    total_commitment_minor,
    currency_code,
    set_minutes,
    performance_count,
    provisional_date,
    provisional_stage_id,
    billing_position,
    contract_terms
  ) VALUES (
    offer.festival_artist_programme_id,
    offer.id,
    offer.artist_type,
    offer.artist_profile_id,
    offer.band_id,
    offer.npc_artist_id,
    offer.offered_fee_minor,
    offer.travel_support_minor,
    offer.accommodation_support_minor,
    total,
    offer.currency_code,
    offer.set_minutes,
    offer.performance_count,
    offer.preferred_date,
    offer.preferred_stage_id,
    offer.billing_position,
    (SELECT revision.terms_snapshot
      FROM public.festival_artist_offer_revisions revision
      WHERE revision.offer_id = offer.id
        AND revision.offer_version = offer.offer_version)
  ) RETURNING * INTO booking;

  INSERT INTO public.festival_financial_commitments(
    festival_company_id,
    artist_booking_id,
    amount_minor,
    currency_code
  ) VALUES (
    programme.festival_company_id,
    booking.id,
    total,
    offer.currency_code
  ) RETURNING * INTO commitment;

  UPDATE public.festival_artist_applications
  SET status = 'accepted', updated_at = now(), version = version + 1
  WHERE id = offer.application_id;

  UPDATE public.festival_artist_invitations
  SET status = 'converted_to_offer', version = version + 1
  WHERE id = offer.invitation_id;

  PERFORM public._festival_artist_audit(
    programme.festival_company_id,
    actor,
    'offer',
    offer.id,
    'offer_accepted',
    NULL,
    'accepted',
    offer.offer_version
  );
  PERFORM public._festival_artist_audit(
    programme.festival_company_id,
    actor,
    'booking',
    booking.id,
    'booking_confirmed',
    NULL,
    'awaiting_schedule',
    booking.version
  );
  PERFORM public._festival_artist_notify(
    request.id,
    actor,
    'booking_confirmed',
    'Festival booking confirmed',
    'The accepted terms are now reserved against this annual Festival budget.'
  );

  RETURN public._festival_artist_finish(
    request.id,
    jsonb_build_object(
      'kind', 'booking',
      'offer', to_jsonb(offer),
      'booking', to_jsonb(booking),
      'commitment', to_jsonb(commitment)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._festival_artist_committed_minor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_festival_edition_artist_candidates(uuid, uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_festival_edition_artist_invitation(uuid, uuid, text, uuid, uuid, bigint, integer, date[], timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_festival_edition_artist_offer(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_festival_edition_artist_offer(uuid, uuid, uuid, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_festival_edition_artist_candidates(uuid, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_festival_edition_artist_invitation(uuid, uuid, text, uuid, uuid, bigint, integer, date[], timestamptz, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_edition_artist_offer(uuid, uuid, uuid, uuid, text, uuid, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_festival_edition_artist_offer(uuid, uuid, uuid, integer, uuid) TO authenticated;
